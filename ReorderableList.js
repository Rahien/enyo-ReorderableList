
document.onselectstart=enyo.dispatch;

//* a quick kind to render the default dragger
enyo.kind({
    name:"_ReorderListDragger",
    published:{
        //* the node this item is derived from
        originalNode:null,
        //* the index in the list that is being dragged around (if any! element may not be in list atm)
        holding:null,
        //* the value of the list that is being dragged around
        value:null,
        //* the default z-index of the control
        zIndex:100,
        //* the background color to take if the background is transparant
        background:"rgba(0,0,0,0)"
    },
    render:function(){
        this.parentNode = document.body;

        this.inherited(arguments);
        
        var draggerNode = this.hasNode();

        this.applyStyle("position","absolute");
        this.applyStyle("width",(this.originalNode.offsetWidth)+"px");
        this.applyStyle("height",(this.originalNode.offsetHeight)+"px");
        this.applyStyle("box-sizing","border-box");
        this.applyStyle("-moz-box-sizing","border-box");
        this.applyStyle("-webkit-box-sizing","border-box");

        draggerNode.appendChild(this.originalNode);

        this.backgroundChanged();
        this.zIndexChanged();

        this.addClass("reorderlist-dragger");
    },
    destroy:function(){
        if(this.nodeStash){
            this.nodeStash.parentNode.removeChild(this.nodeStash);
        }
        this.inherited(arguments);
    },
    zIndexChanged:function(){
        this.applyStyle("z-index",this.zIndex);
    },
    backgroundChanged:function(){
        var style=enyo.dom.getComputedStyle(this.originalNode);
        if(style["background-color"]==null || style["background-color"] == "none" || style["background-color"] == "rgba(0, 0, 0, 0)"){
            this.applyStyle("background-color",this.background);
        }
    },
    //* stores the given node in a safe place to keep it getting events when it would have been deleted
    storeNode:function(target){
        var node=this.hasNode();
        if(!node){
            return;
        }
        if(this.nodeStash){
            this.nodeStash.parentNode.removeChild(this.nodeStash);
        }
        node.parentNode.appendChild(target);
        target.style.display="none";
        this.nodeStash=target;
    }
});

enyo.kind({
    name:"ReorderableList",
    kind:"PulldownList",

    handlers:{
        onSetupItem:"handleSetup",
        onhold:"handleHold",
        ondragfinish:"handleDragFinish",
        onup:"handleRelease",
        onresize:"handleResize",
        ondragstart:"handleDragStart",
        onselectstart:"handleSelectStart",
        onrelease:"handleSlowRelease"
    },

    events:{
        /**
           the reorderable list can reorder the data list.
           the event is decorated with the following properties
           - added: index at which an element was added (holds the new value that was added, old elements moved to the right)
           - removed: index at which an element was removed.
         */
        onReorder:""     
    },

    published: {
        //* the data to be shown in this list, use this when handling the onSetupItem event
        data:null,
        //* the pulse interval at which the scroll direction is being checked when dragging in ms (defaults to 100)
        scrollCheckDuration:100,
        //* the speed limits for the drag-scroll in percentage per pulse (defaults to {min:-0.2,max:0.2})
        scrollSpeedLimits:{min:-0.2, max:0.2},
        //* the kind to use as a dragger component (defaults to the private _ReorderListDragger class)
        draggerKind:_ReorderListDragger,
        //* whether or not the list allows removing items by dropping them outside of the list (defaults to true)
        allowRemove:true
    },

    //* @public
    //* the spec of the placeholder to be inserted into the list
    placeholder:{kind:"enyo.Control"},

    initComponents:function(){

        this.inherited(arguments);

        this.controlParentName=null;
        this.data=this.data || [];

        // create an enyo instance for the placeholder, but do not render it!
        this.placeholder.name="placeholder";
        var classname="reorderlist-holding";
        this.placeholder.classes=this.placeholder.classes?this.placeholder.classes+" "+classname:classname;
        this.placeholder.owner=this;
        this.createComponents([{name:"placeholder-stash", style:"display:none;",components:[this.placeholder]}]);
        this.controlParentName="client";
        this.discoverControlParent();
    },

    //* @protected
    
    dataChanged:function(){
        var data=this.getData();
        this.setCount(data.length);
        this.refresh();
    },
    
    create:function(){
        this.inherited(arguments);

        // intercept the drag event in strategy
        var list=this;
        var oldDrag=enyo.bind(this.$.strategy,this.$.strategy.drag);
        this.$.strategy.drag=function(source,event){
            if(!list.handleDrag(source,event) && oldDrag){
                oldDrag(source,event);
            }
        };

        this.addClass("reorderlist");
    },
    rendered:function(){
        this.inherited(arguments);
        this.dataChanged();
        this.refresh();
    },
    //* @protected
    //* the dragger control that is used to move an item of the list to another position
    dragger:null,

    //* handles the hold event by creating a dragger for the selected item
    handleHold:function(source,event){
        // check if holding an element in the list
        if(event.rowIndex<0){
            return;
        }

        event.preventDefault();
        // explicitly re-render the row that is being held to fix background but stash the nod that was being held to saveguard its events
        this.buildDragger(event.rowIndex);
        this.moveDraggerToPointer(event);
        this.storeHeldNode(event.rowIndex);
        this.renderRow(event.rowIndex);
    },
    //* stores the node at the given index in the dragger and places a new node in its place whose html should be overwritten asap
    storeHeldNode:function(index){
        var node = this.$.generator.fetchRowNode(index);
        node=node && node.children[0];
        var parent=node.parentNode;
        var replacement=document.createElement("div");
        var style=enyo.dom.getComputedStyle(node);
        replacement.style.cssText=style.cssText || node.style.cssText;
        parent.insertBefore(replacement,node);
        
        this.dragger.storeNode(node);
    },
    //* Builds a dragger to drag the item at the given index around
    buildDragger:function(index){
        if(this.dragger){
            var held=this.dragger.holding;
            this.dragger.destroy();
            this.dragger=null;
            if(held){
                this.renderRow(held);
            }

        }
        
        this.prepareRow(index);
        var target = this.$.client.children[0];
        var targetNode=target.hasNode();
        
        var dragger = new this.draggerKind({originalNode:targetNode,
                                            originalIndex:index,
                                            holding:index,
                                            background:"white",
                                            value:this.data[index],
                                            owner:this});
        dragger.render();
        
        var position=this.getNodePosition(targetNode);
        position.top=position.top-this.getScrollTop();
        dragger.setBounds({left:position.left, top:position.top});

        this.dragger=dragger;
        this.lockRow();
    },

    //* @public
    //* Renders the row specified by _inIndex_. If the index equals the element that is currently being held, the placeholder is rendered in its place
    renderRow: function(inIndex) {
        if(this.dragger!=null && this.dragger.holding===inIndex){
            var node = this.$.generator.fetchRowNode(inIndex);
            if(node){
                this.$.placeholder.setBounds({width:node.offsetWidth, height:Math.max(node.offsetHeight, this.rowHeight)});
                node.innerHTML=this.$.placeholder.generateHtml();               
                this.$.generator.$.client.teardownChildren();
            }
        }else{
            this.inherited(arguments);
        }
    },

    //* @protected
    //* handling the release event by removing the dragger _if we have not moved it yet_
    handleRelease:function(source,event){
        if(navigator.appName == 'Microsoft Internet Explorer'){
            // ie has mystical move event that prevents immediate dragging, going for two click approach :(
            return;
        }
        if(!this.draggingRow){
            this.endDrag(source,event);
        }
    },

    //* handle the dragfinish event by removing the dragger (the item has already been moved)
    handleDragFinish:function(source,event){
        this.dragging=false;
        this.endDrag(source,event);
    },

    //* prevent the default action for dragging
    handleDragStart:function(source,event){
        this.dragging=true;
        event.preventDefault();
    },

    //* prevents smartphones from messing up dragging by mystical release event
    handleSlowRelease:function(source,event){
        if(navigator.appName == 'Microsoft Internet Explorer'){
            // ie has mystical move event that prevents immediate dragging, going for two click approach :(
            return;
        }
        
        // release is fired when dragging starts
        var cleanup=enyo.bind(this,function(){
            if(!this.dragging){
                this.handleRelease(source,event);
            }
        });
        setTimeout(cleanup,100);
    },

    //* prevent the default action for selection
    handleSelectStart:function(source,event){
        event.preventDefault();
    },

    //* handle all actions to be done when dragging completes, cleaning up the dragger and re-rendering the dragged row
    endDrag:function(source,event){
        this.draggingRow=false;
        if(this.dragger==null){
            return;
        }
        event.preventDefault();
        
        var held=this.dragger.holding;

        if(held == null && !this.allowRemove){
            this.reorderList({insert:{index:this.dragger.originalIndex, value:this.dragger.value}});
            this.renderRow(this.dragger.originalIndex);
            this.refresh();
        }

        
        this.dragger.destroy();
        this.dragger=null;
        this.scrollspeed=0;
        
        this.renderRow(held);
    },
    
    //* handles the drag event by moving the dragger if any and immediately replacing its contents in the list
    handleDrag:function(source,event){
        if(this.dragger){
            this.checkScrollAtDrag(source,event);
            
            this.moveDraggerToPointer(event);
            this.draggingRow=true;
            
            // move the dragged item around
            this.moveDraggedItem(source,event);
            
            return true;
        }
    },
    
    //* moves the dragged item to the mouse event that is passed in
    moveDraggedItem:function(source,event,norefresh){
        if(this.dragger==null){
            return;
        }
        var pos=this.getMousePosition(event);
        var index=this.getRowIndexFromCoordinate({top:pos.y, left:pos.x});
        if(index===this.dragger.holding){
            // we are already holding the given index, do nothing
            return;
        }

        // prepare the correct object for handling the reordering
        var held=this.dragger.holding;
        var reorderObject={};
        if(held!=null){
            reorderObject.remove=held;
        }
        if(index!=null){
            reorderObject.insert={index:index,value:this.dragger.value};
        }
        var insertPos=this.reorderList(reorderObject);
        this.dragger.holding=insertPos;

        if(!norefresh){
            // refreshing takes too much time while scrolling. postpone until completed
            this.dataChanged();
        }
    },
    //* @public
    //* When refreshing the list, we also need to render the row that is being dragged explicitly
    refresh:function(){
        this.inherited(arguments)
        
        // need to render holding row explicitly
        if(this.dragger && this.dragger.holding!=null){
            this.renderRow(this.dragger.holding);
        }
    },
    //* @protected
    //* checks if the list should scroll when dragging and starts the scroll timeout if so.
    checkScrollAtDrag:function(source,event){
        var mouse=this.getMousePosition(event);
        var position=this.getNodePosition(this.hasNode());
        var bounds=this.getBounds();

        this.lastScrollEvent={source:source,event:event};

        if(mouse.y-position.top<bounds.height*0.2){
            var percentage=Math.max(0,Math.min(1,(bounds.height*0.2-(mouse.y-position.top))/(bounds.height*0.2)));
            var percentage=percentage*percentage;
            
            this.scrollSpeed=this.scrollSpeedLimits.min*bounds.height*percentage;
        }else if(mouse.y-position.top>bounds.height*0.8){
            var percentage=Math.max(0,Math.min(1,((mouse.y-position.top)-bounds.height*0.8)/(bounds.height*0.2)));
            percentage=percentage*percentage;
            this.scrollSpeed=this.scrollSpeedLimits.max*bounds.height*percentage;
        }else{
            this.scrollSpeed=0;
        }
        if(this.scrollSpeed!=0){
            if(!this.scrollTimeout){
                this.scrollTimeout=setTimeout(enyo.bind(this,this.doScrollAtDrag),this.scrollCheckDuration);
            }
        }
    },
    //* a function that keeps a timeout going as long as the scrollspeed is not zero.
    doScrollAtDrag:function(){
        if(this.dragger && this.scrollSpeed!=0){
            this.setScrollPosition(this.getScrollPosition()+this.scrollSpeed);
            this.moveDraggedItem(this.lastScrollEvent.source,this.lastScrollEvent.event,true);

            this.scrollTimeout=setTimeout(enyo.bind(this,this.doScrollAtDrag),this.scrollCheckDuration);
        }else{
            this.scrollSpeed=0;
            this.scrollTimeout=null;
            // refreshing was postponed during scroll, but now, we have the time.
            this.refresh();
        }
    },
    //* the last scroll initiating mouse event that was recorded, used for positioning purposes
    lastScrollEvent:null,
    //* the last recorded scrollspeed
    scrollSpeed:0,
    //* the current timout that will fire doScrollAtDrag, if any
    scrollTimeout:null,
    //* @public
    /**
       reorders the list according to the given constraints. The constraints can contain the following properties:
       - remove: the index from which to remove an element in the list
       - insert: an object {index, value} that holds the index at which an element should be inserted in the list

       if both properties are present, the remove operation will be handled first

       returns the index at which a new element was inserted if any
    */
    reorderList:function(constraints){
        var data=this.getData();
        
        // first handle remove and take care of moving the index
        if(constraints.remove !== undefined){
            data.splice(constraints.remove,1);
        }

        // then do the insertion
        if(constraints.insert){
            if(constraints.insert.index>data.length){
                constraints.insert.index=data.length;
            }

            data.splice(constraints.insert.index,0,constraints.insert.value);
        }

        // fire an event to let other know, should they be listening
        this.doReorder(constraints);
        
        return constraints.insert?constraints.insert.index:null;
    },
    //* @protected
    //* moves the dragger control to the location of the pointer
    moveDraggerToPointer:function(event){
        var pos=this.getMousePosition(event);
        var bounds=this.dragger.getBounds();
        this.dragger.setBounds({top:pos.y-bounds.height/2, left:pos.x-bounds.width/2});
    },
    //* determines the position of the given mouse event on the page.
    getMousePosition:function(e){
        e = e || window.event;
        var cursor = {x:0, y:0};
        if (e.pageX || e.pageY) {
            cursor.x = e.pageX;
            cursor.y = e.pageY;
        }
        else {
            cursor.x = e.clientX +
                (document.documentElement.scrollLeft ||
                 document.body.scrollLeft) -
                document.documentElement.clientLeft;
            cursor.y = e.clientY +
                (document.documentElement.scrollTop ||
                 document.body.scrollTop) -
                document.documentElement.clientTop;
        }
        return cursor;
    },
    //* gets the position of a node on the page, taking translations into account
    getNodePosition:function(node){
        var originalNode=node;
        var offsetTop=0;
        var offsetLeft=0;
        while(node && node.offsetParent){
            offsetTop+=node.offsetTop;
            offsetLeft+=node.offsetLeft;
            node=node.offsetParent;
        }

        // second pass to get transforms 
        node=originalNode;
        var cssTransformProp=enyo.dom.getCssTransformProp();
        while(node && node.getAttribute){
            var matrix=enyo.dom.getComputedStyleValue(node,cssTransformProp);
            if(matrix && matrix != "none"){
                var last=matrix.lastIndexOf(",");
                var secondToLast=matrix.lastIndexOf(",",last-1);
                if(last>=0 && secondToLast>=0){
                    offsetTop+=parseFloat(matrix.substr(last+1,matrix.length-last));
                    offsetLeft+=parseFloat(matrix.substr(secondToLast+1,last-secondToLast));             
                }
            }
            node=node.parentNode;
        }
        return {top:offsetTop,left:offsetLeft};
    },
    //* returns the row index that is under the given position on the page
    getRowIndexFromCoordinate:function(position){
        var scrollPosition=this.getScrollTop();
        var node=this.hasNode();
        var bounds=this.getBounds();
        var pos=this.getNodePosition(node);
        var offsetTop=pos.top; var offsetLeft=pos.left;
        
        // assumes all nodes have same height
        var nodeHeight=this.rowHeight;
        var positionInList=this.getScrollTop()+position.top-offsetTop;

        var index= Math.floor(positionInList/nodeHeight);

        if(position.top<offsetTop || position.top>offsetTop+bounds.height ||
           position.left<offsetLeft || position.left>offsetLeft+bounds.width){
            return null;
        }else{
            return index;
        }
    }

});
