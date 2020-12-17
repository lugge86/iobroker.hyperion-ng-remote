"use strict";

const net = require('net');

class HngApi
{
    sysinfo = null;
    serverinfo = null;

    constructor(ip, port, origin, notifyClbk, timeout) {
        this.origin = origin;
        this.callback = notifyClbk;
        this.ip = ip;
        this.port = port;
        this.timeout = timeout;
        this.rxBuffer = "";
        
        this.socket = new net.Socket();
        this.socket.on("connect", this.OnConnectClbk.bind(this));
        this.socket.on("data", this.OnDataClbk.bind(this));
        this.socket.on("close", this.OnCloseClbk.bind(this));
        this.socket.on("end", this.OnCloseClbk.bind(this));
        this.socket.on("error", this.OnCloseClbk.bind(this));
        
        
        this.connected = false;
        
        this.debugCmdSent = 0;
        this.debugChungsReceived = 0;
        this.debugResponsesReceived = 0;
        
        this.pendingCtr = 0;
    }
    
    Connect() {
        this.socket.connect(this.port, this.ip);
    }

    SourceSelection(prio) {
        var requestJson = {
            command: "sourceselect",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    ServerInfo() {
        var requestJson = {
            command: "serverinfo",
            //subscribe:["priorities-update"],
            tan: 1
        };
        this.SendRequest(requestJson);
    }
    
    Subscribe(priorities=false) {
        var subscribes = [];
        
        if (priorities==true) {
            subscribes.push("priorities-update");
        }
        
        var requestJson = {
            command: "serverinfo",
            subscribe:subscribes,
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    GetPriorities() {
        return this.serverinfo.priorities;
    }

/***********************************************************/
    SysInfo() {
        var requestJson = {
            command: "sysinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    GetSysInfo() {
        return this.sysinfo;
    }

/***********************************************************/
    ComponentState(name, enabled) {
        var requestJson = {
            command: "componentstate",
            componentstate: {
                component: name,
                state: enabled
            }
        };
        this.SendRequest(requestJson);
    }

    GetComponentList() {
        return this.serverinfo.components;
    }

/***********************************************************/
    GetEffects() {
        return this.serverinfo.info.effects;
    }

    GetEffectList() {
        var ret = new Array();

        if (this.serverinfo) {
            for (var effect of this.serverinfo.effects) {
                ret.push(effect.name);
            }
        }

        return ret;
    }

/***********************************************************/
    Color(color, prio, duration) {
        var requestJson = {
            command: "color",
            color: color,
            priority: prio,
            origin: this.origin
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    Effect(effect, prio, duration) {
        var requestJson = {
            command: "effect",
            effect: {
                name: effect
            },
            priority: prio,
            origin: this.origin
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }

/***********************************************************/
    Clear(prio) {

        if (prio > 253)
        {
            //todo: throw error
            return;
        }

        var requestJson = {
            command: "clear",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

    ClearAll() {
        this.Clear(-1);
    }

        
    
    OnDataClbk(data) {
        this.rxBuffer += data;
        this.debugChungsReceived++;
        
        var jsonArray = this.rxBuffer.split(/\r?\n/);       
        var i;

        for (i=0; i<jsonArray.length-1; i++  ) {
            this.HandleResponse( JSON.parse(jsonArray[i]) );
            this.pendingCtr--;
            this.debugResponsesReceived++;
        }
        
        if (this.pendingCtr == 0) {
            //todo: reset timeouthandler
        }
            
        this.rxBuffer =  jsonArray[i];
    }
    
    
    OnCloseClbk() {
        this.connected = false;
    }
    
    OnConnectClbk() {
        this.connected = true;
    }
    
        
    HandleResponse(responseJson) {
        
        var retError = null;
        
        if (responseJson.success == false) {
            /* request answered by hyperion, but with issues */
            retError = responseJson.error;
        } else {
            /* request was executed properly by hyperion */
            /* now, depending on the received message, further actions are necessary */
            switch(responseJson.command) {
                case "serverinfo": {
                    this.serverinfo = responseJson.info;
                    break;
                }
                case "sysinfo": {
                    this.sysinfo = responseJson.info;
                    break;
                }
                case "priorities-update": {
                    this.serverinfo.priorities = responseJson.data.priorities;
                    this.serverinfo.priorities_autoselect = responseJson.data.priorities_autoselect;
                    break;
                }
                default: {
                    break;
                }
            }
        }
        
        /* finally, notify the application via callback */
        this.callback(responseJson.command, retError);
    }
    
    
    
/***********************************************************/
    SendRequest(requestJson) {
        
        /* first, create object containing all the needed options for our request */
        var requestString = (JSON.stringify(requestJson) + "\n");
        this.socket.write(requestString);
        
        this.pendingCtr++;
        this.debugCmdSent++;
    }
    
    
    HandleTimeout(command) {
        this.callback(command, "timeout detected by application");
    }
}

module.exports.HngApi = HngApi;
