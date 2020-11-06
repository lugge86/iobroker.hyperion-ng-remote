"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require('request');
const schedule = require('node-schedule');

// Load your modules here, e.g.:
// const fs = require("fs");

class HyperionNgRemote extends utils.Adapter {

    sysinfoFinished = false;
    serverinfoFinished = false;
    
    colorsConfigured = 0;
    colorsConfiguredConfirmed = 0;
    
    priosDeleted = 0;
    priosDeletedConfirmed = 0;
    
    cycleTimer = null;

    currentState = null;

    states = {
        init: 1,
        connecting: 2,
        cleaning: 3,
        configuring: 4,
        ready: 5,
        error: 6
    };

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

        this.currentState = this.states.init;
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
        this.log.info("config User IP: " + this.config.serverIp);
        this.log.info("config Port: " + this.config.serverPort);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync("selectPrio", {
            type: "state",
            common: {
                name: "select active priority",
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


        this.ProcessStateMachine();
        this.cycleTimer = schedule.scheduleJob("*/5 * * * * *", this.ProcessStateMachine.bind(this)  );
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
        if (this.currentState == this.states.ready) {
            if (state) {
                
                switch(id){
                    case "hyperion-ng-remote.0.selectPrio": {
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
    }


    NotifyCallback(command, error)
    {
        if (error) {
        } else {
            switch(command) {
                case "serverinfo": {
                    this.serverinfoFinished = true;
                    break;
                }
                case "sysinfo": {
                    this.sysinfoFinished = true;
                    break;
                }
                case "color": {
                    this.colorsConfiguredConfirmed++;
                    break;
                }
                case "sourceselect": {
                    break;
                }
                case "clear": {
                    this.priosDeletedConfirmed++;
                    break;
                }
                default: {
                    break;
                }
            }
        }

        this.ProcessStateMachine();
    }

    ProcessStateMachine() {

        switch (this.currentState) {
            case this.states.init: {

                if (1) {
                    /* create hyperion api obj and send initial commands to get some information from server */
                    this.conn = new HyperionApi(this.config.serverIp, this.config.serverPort, this.config.appname, this.NotifyCallback.bind(this), this.log.info);
                    this.conn.ServerInfo();
                    this.conn.SysInfo();
                    
                    this.currentState = this.states.connecting;
                    this.log.info("init => connecting");
                }
                else{
                    /* error with IP config, no connection to server possible */
                    this.log.info("Error with IP config");
                    this.currentState = this.states.error;
                    this.log.info("init => error");
                }

                break;
            }

            case this.states.connecting: {
                /*
                 * In this state we just wait till we are "connected" to hyperion,
                 * this is when the serverinfo and sysinfo commands have returned.
                 */
                if ( (this.sysinfoFinished == true) && (this.serverinfoFinished == true) ) {
                    /* start cleaning the server from old configuration data */
                    this.Clean();

                    this.currentState = this.states.cleaning;
                    this.log.info("connecting => cleaning");
                }

                break;
            }

            case this.states.cleaning: {

                if( this.priosDeleted == this.priosDeletedConfirmed ) {
                    /* now write our color and effect configuration to hyperion */
                    this.ColorConfig();
                    
                    this.currentState = this.states.configuring;
                    this.log.info("cleaning => configuring");
                }

                break;
            }

            case this.states.configuring: {
                /*
                 * Here we wait till all configuration jobs have been
                 * confirmed by hyperion server.
                 */

                if ( this.colorsConfigured == this.colorsConfiguredConfirmed ) {
                    /* all went well, create DPs and set adapter info to "connected" */
                    this.CreateDataPoints();
                    this.setState("info.connection", true, true);

                    this.currentState = this.states.ready;
                    this.log.info("configuring => ready");
                }

                break;
            }

            case this.states.ready: {
                /* nothing to do here, this is the normal operation mode */
                break;
            }

            case this.states.error: {
                /* do nothing */
                break;
            }

            default: {
                break;
            }
            
            this.ProcessStateMachine();
        }
    }


    Clean() {
        var configuredPrios = this.conn.GetServerInfoPriorities()
        for (var prio of configuredPrios) {
            if (prio.origin == this.config.appName) {
                /* this was set by us in an previous run, thus, get rid of it */
                this.conn.Clear(prio.priority);
                this.priosDeleted++;
            }
        }
    }


    CreateDataPoints() {
    }


    ColorConfig() {
        const hexToRgb = function (hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
            ] : null;
        }

        for(var color of this.config.colors) {
            this.conn.Color( hexToRgb(color.color), Number(color.prio), 0);
            this.colorsConfigured++;
        }
    }
}




class HyperionApi
{
    sysinfo = null;
    serverinfo = null;

    constructor(ip, port, origin, notifyClbk, logger) {
        this.origin = origin;
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

/***********************************************************/
    ServerInfo() {
        var requestJson = {
            command: "serverinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    ServerInfoClbk(data) {
        this.serverinfo = data;
    }

    GetServerInfoPriorities() {
        return this.serverinfo.info.priorities;
    }

/***********************************************************/
    SysInfo() {
        var requestJson = {
            command: "sysinfo",
            tan: 1
        };
        this.SendRequest(requestJson);
    }

    SysInfoClbk(data) {
        this.sysinfo = data;
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
        componentList = [];
        for (component of serverinfo.components) {
            componentList.push(component.name);
        }
        return componentList;
    }

    GetComponentEnabled(name) {
        ret = null;
        for (component of serverinfo.components) {
            if (component.name == name) {
                ret = component.enabled;
            }
        }

        return ret;
    }

/***********************************************************/
    GetEffectList() {
        effectList = [];
        for (effect of serverinfo.effects) {
            effectList.push(effect.name);
        }
        return effectList;
    }

    GetEffectDetails(name) {
        ret = null;
        for (effect of serverinfo.effects) {
            if (effect.name == name) {
                ret = effect;
                break;
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
    Clear(prio) {
        var requestJson = {
            command: "clear",
            priority: prio
        };
        this.SendRequest(requestJson);
    }

    ClearAll() {
        this.Clear(-1);
    }

/***********************************************************/
    SendRequest(requestJson) {
        /* first, create object containing all the needed options for our request */
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

        /*
         * Now make the actual request.
         * The result will later be available in the request callback.
         */
        var self = this;
        this.logger("sending request: " + requestJson.command);
        request.post(requestOptions,
            function(error, response, body) {

                var retError = null;
                var retCommand = requestJson.command;

                if (error) {
                    /* this means request was not answered by hyperion */
                    self.logger("request not executed: " + requestJson.command);
                    self.logger(error)
                    retError = error;
                } else {
                    var responseJson = JSON.parse(body);
                    if (responseJson.success == false) {
                        /* request answered by hyperion, but with issues */
                        self.logger("request executed with issues: " + responseJson.command);
                        self.logger(responseJson.error)
                        retError = responseJson.error;
                    } else {
                        /* request was executed properly by hyperion */
                        self.logger("request executed properly: " + responseJson.command);
                        switch(responseJson.command) {

                            case "serverinfo": {
                                self.ServerInfoClbk(responseJson);
                                break;
                            }
                            case "sysinfo": {
                                self.SysInfoClbk(responseJson);
                                break;
                            }
                            case "color": {
                                break;
                            }
                            case "sourceselect": {
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                    }
                }
                /* finally, notify application via callback */
                self.callback(retCommand, retError);
            }
        );
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



