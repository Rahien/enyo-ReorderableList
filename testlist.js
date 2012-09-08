
var app=new enyo.kind({
    name:"App",
    handlers:{
        onSetupItem:"setupItem"
    },
    components:[
        {name: "list", kind: "ReorderableList",
         style:"height:100%; width:50px;",
         pullingMessage: "",
         pulledMessage: "",
         loadingMessage: "",
         pullingIconClass: "",
         pulledIconClass: "",
         loadingIconClass: "",
         fit: true,
         components: [
             {style: "padding: 10px;",name:"listContent",
              content:"foo"
             }
         ]}
    ]  ,
    create:function(){
        this.inherited(arguments);
        var data=[];
        for(var i=0;i<100; i++){
            data.push(i);
        }
        this.$.list.setData(data);
    },
    setupItem:function(source,event){
        this.$.listContent.setContent(this.$.list.data[event.index]);
    }
});     
new App().renderInto(document.body);
