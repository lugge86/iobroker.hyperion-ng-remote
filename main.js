"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require('request');

// Load your modules here, e.g.:
// const fs = require("fs");

class HyperionNgRemote extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "hyperion-ng-remote",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        
        this.sysinfoFinished = false;
        this.serverinfoFinished = false;
    }
    
    
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info("config option1: " + this.config.option1);
        //this.log.info("config option2: " + this.config.option2);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync("selectPrio", {
            type: "state",
            common: {
                name: "testVariable",
                type: "number",
                role: "state",
                read: true,
                write: true,
            }
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("selectPrio");
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates("lights.*");
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates("*");

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync("testVariable", true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync("testVariable", { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync("admin", "iobroker");
        //this.log.info("check user admin pw iobroker: " + result);

        //result = await this.checkGroupAsync("admin", "admin");
        //this.log.info("check group user admin group admin: " + result);
        
        
        this.connectToHyperion();
        
        
        this.conn = new HyperionApi("192.168.0.83", "8090", this.NotifyCallback.bind(this), this.log.info);        
        //this.log.info( this.conn.GetJsonAddress() );
        this.conn.ServerInfo();
        this.conn.SysInfo();
        this.log.info("sended both requests");
        
        this.conn.Color( [255,0,0], 200, 0)
        this.conn.Color( [0,255,0], 201, 0)
        this.conn.Color( [0,0,255], 202, 0)
        
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            
            switch(id){
                case "hyperion-ng-remote.0.selectPrio": {
                    this.log.info("selectPrio");
                    this.conn.SourceSelection(state.val);
                    break;
                }
                default: {
                    break;
                }
            }
            
        } else {            
            this.log.info(`state ${id} deleted`);
            //todo: throw error
        }
    }

    connectToHyperion()
    {
        var self = this;
        //self.log.info("connecting in 10s");
        //setTimeout( function() { self.log.info("connected"); self.setState("info.connection", true, true); }, 10000);
    }
    
    
    NotifyCallback(response)
    {
        this.log.info("callback for: " + response.command);
        
        
        if (response)
        {
                        
            if (response.command == "serverinfo")
            {
                this.serverinfoFinished = true;
                this.log.info("serverinfoFinished true");
            }
            else if (response.command == "sysinfo")
            {
                this.sysinfoFinished = true;
                this.log.info("sysinfoFinished true");
            }
            
            
            this.log.info(this.sysinfoFinished + " === " + this.serverinfoFinished);
            
            
            if  ( (this.sysinfoFinished == true) && (this.serverinfoFinished == true) )
            {
                this.log.info("connected");
                this.setState("info.connection", true, true);
            }
        }
        else
        {
            this.log.info("no response");
        }
        
    }


}


class HyperionApi
{    
    constructor(ip, port, notifyClbk, logger) {
        logger("Creating new Connection with IP "+ ip);
        this.callback = notifyClbk;
        this.logger = logger;
        this.jsonUrl = "http://" + ip + ":" + port + "/json-rpc";        
    }
    
    
    SourceSelection(prio) {
        var requestJson = {
            command: "sourceselect",
            priority: prio
        };    
        this.SendRequest(requestJson);
    }

    
    ServerInfo() {
        var requestJson = {
            command: "serverinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }
        
    SysInfo() {
        var requestJson = {
            command: "sysinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }
        
    Color(color, prio, duration) {
        var requestJson = {
            command: "color",
            color: color,
            priority: prio,
            origin: "hyperion ng adapter"
            //todo
            //"duration": duration
        };
        this.SendRequest(requestJson);
    }
        
    SendRequest(requestJson) {
        var ret = null;
        /* create object containing all the needed options for our request */
        var requestString = JSON.stringify(requestJson);
        var requestOptions = {
            url: this.jsonUrl,
            method: 'POST',
            body: requestString,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestString.length
            }
        };

        /* now call API function for making the request */
        var self = this;
        
        self.logger("sending request: " + requestJson);
        
        request.post(requestOptions, function(error, response, body) {        
            if (error) {
                self.logger("error during request")                
            } else {
                var json = JSON.parse(body);
                if (json.success == false) {
                    self.logger( json.error );
                } else {
                    self.logger("request OK: " + json.command);
                    ret = json;
                    //self.callback(json);
                }
            }
            
            //self.logger("calling clbk: " + self.callback);
            self.callback(ret);
        } );      
        
    }
    
}



// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new HyperionNgRemote(options);
} else {
    // otherwise start the instance directly
    new HyperionNgRemote();
}



