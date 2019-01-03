var app = {
    iMatchDevice: [],  // get the mac address from iMatch.list

    /*
        Application constructor
    */
    initialize: function() {
        this.bindEvents();
        console.log("Starting iMatch app");
    },

    /*
        bind any events that are required on startup to listeners:
    */
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        connectButton.addEventListener('touchend', app.manageConnection, false);
        syncButton.addEventListener('touchend', app.sync, false);
        batteryButton.addEventListener('touchend', app.batteryButtonPressed, false);
        fingerButton.addEventListener('touchend', app.fingerButtonPressed, false);
        nfcButton.addEventListener('touchend', app.nfcButtonPressed, false);
        smartcardButton.addEventListener('touchend', app.smartcardButtonPressed, false);
    },

    /*
        this runs when the device is ready for user interaction:
    */
    onDeviceReady: function() {
        // check to see if Bluetooth is turned on.

        // check if Bluetooth is on:
        app.isNFCEnabled(
            function(success) {
                app.open();
            },
            function(error) {
                app.display("Bluetooth is not enabled.")
            }
        );
    },

    /*
        Connects if not connected, and disconnects if connected:
    */
    manageConnection: function() {
        // connect() will get called only if isConnected() (below)
        // returns failure. In other words, if not connected, then connect:
        var connect = function () {
            // if not connected, do this:
            // clear the screen and display an attempt to connect
            app.clear();
            app.display("Attempting to connect..");
            // attempt to connect:
            iMatch.connect(
                app.iMatchDevice.id,  // device to connect to
                app.openPort,    // start listening if you succeed
                function(error) {
                    app.showError(error);    // show the error if you fail
                    app.open();
                }
            );
        };

        // disconnect() will get called only if isConnected() (below)
        // returns success  In other words, if  connected, then disconnect:
        var disconnect = function () {
            app.display("Attempting to disconnect");
            // if connected, do this:
            iMatch.disconnect(
                app.closePort,     // stop listening to the port
                app.showError      // show the error if you fail
            );
        };

        // here's the real action of the manageConnection function:
        iMatch.isConnected(disconnect, connect);
    },

    /*
        Lists BT devices in range:
    */
    open: function() {
        iMatch.list(
            function(results) {
                app.clear();
                for (var i in results){
                    // connect to the first device found
                    iMatch.connect(
                        results[i].uuid,  // device to connect to
                        function(success) {
                            iMatch.subscribe(function (data) {
                                var message = JSON.parse(data);
                                if (message.method === "info")
                                {
                                    app.display("Firmware " + message.data.version);
                                }
                                else if (message.method === "status")
                                {
                                    app.display("Battery: " + message.data.cv);
                                }
                            },function (error) {
                                app.display(JSON.stringify(error));
                            });
                            app.display("Connected to " + results[i].uuid);
                            
                            // get the firmware version running on the connected device
                            iMatch.write({imatch: "1.0", device: "sys", method: "info", params: ""});
                        },
                        function(error) {
                            console.log('Connect failed');
                            app.display('Connect failed');
                        }
                    );
                    break;
                }
            },
            function(error) {
                app.display(JSON.stringify(error));
            }
        );
    },

    bindEvent: function(event, callback){

    },

    /*
        subscribes to a Bluetooth serial listener for newline
        and changes the button:
    */
    openPort: function() {
        // if you get a good Bluetooth serial connection:
        app.clear();
        app.display("Connected to: " + app.iMatchDevice.name + " - " + app.iMatchDevice.uuid);
        // change the button's name:
        connectButton.innerHTML = "Disconnect";
    },

    /*
        sync datetime with iMatch
    */
    sync: function() {
        iMatch.subscribe(function (data) {
            var message = JSON.parse(data);
            if (message.device == 'sys' && message.method == 'datetime') {
                app.display('SYS.datetime: Datetime synchronized! (' + message.data + ')');
            }
        }, function (error) {
            console.log("sync error: " + error);
            callbackError(error);
        });

        iMatch.write({imatch: "1.0", device: "sys", method: "datetime", params: "(" + moment().format('YYYY, MM, D, E, H, m, s') + ", 0)"});
    },

    batteryButtonPressed: function() {
        app.getBatteryLevel(function(data) {
            app.display('SYS.notify: ' + data);
        },
        function(error) {
            app.showError(error);
        });
    },

    getBatteryLevel: function(callbackSuccess){
        iMatch.subscribe(function (data) {
            console.log("getBatteryLevel: " + data);
            var message = JSON.parse(data);
            callbackSuccess(message.data.cv + "%");
        }, function (error) {
            console.log("getBatteryLevel error: " + error);
        });

        iMatch.write({imatch: "1.0", device: "sys", method: "status", params: ""});
    },

    fingerButtonPressed: function() {
        app.scanFingerprint(function(data) {
            app.display('FPR.notify: Fingerprint captured!');
        },
        function(error) {
            app.showError(error);
        });
    },

    /*
        request wsq enrollment from iMatch
    */
    scanFingerprint: function(callbackSuccess, callbackError){
        iMatch.subscribe(function (data) {
            var message = JSON.parse(data);
            if (message.method === "power_on")
            {
                console.log("FPR power on: " + JSON.stringify(message.data));
            }
            else if (message.method === "notify")
            {
                var notificationData = atob(message.data);
                var fprData = iMatch.stringToArrayBuffer(notificationData)

                if (notificationData.charCodeAt(0) == 0x71) // notification
                {
                    var hex = Array.prototype.map.call(new Uint8Array(fprData), x => ('00' + x.toString(16)).slice(-2)).join('');
                    console.log("FPR notify: " + hex);
                    app.display("FPR.notify: " + hex);
                }
                else if (notificationData.charCodeAt(0) == 0x21) // fingerprint data
                {
                    console.log("FPR.data: ", fprData);
                    console.log("FPR.data1: ", notificationData);
                    callbackSuccess(fprData);
                    iMatch.write({imatch: "1.0", device: "fpr", method: "power_off", params: ""});
                }
                else
                {
                    console.log("FPR notify: " + data);
                }
            }

        }, function (error) {
            console.log("scanFingerprint error: " + error);
            callbackError(error);
        });

        iMatch.write({imatch: "1.0", device: "fpr", method: "power_on", params: ""});

        app.sleep(1000).then(() =>  {
            var wsq = '2118000000000001010000340400050000003D0600003E02009C0F';
            var param = btoa(wsq.match(/\w{2}/g).map(function(a){return String.fromCharCode(parseInt(a, 16));} ).join(""));
            iMatch.write({imatch: "1.0", device: "fpr", method: "send", params: param});
        });
    },

    stopFingerprintScan: function(callbackSuccess, callbackError){
        var iMatch = this;

        this.subscribe(function (data) {
            var message = JSON.parse(data);
            if (message.method === "power_off")
            {
                callbackSuccess(data);
            }

        }, function (error) {
            console.log("stopFingerprintScan error: " + error);
            callbackError(error);
        });

        iMatch.write({imatch: "1.0", device: "fpr", method: "power_off", params: ""});
    },

    smartcardButtonPressed: function() {
        app.readSmartcard(function(message) {
            app.display('SCR.' + message);
        },
        function(error) {
            app.showError(error);
        });
    },

    /*
    read the sc with known ATRs
    */
    readSmartcard: function(callbackSuccess, callbackError){
        iMatch.subscribe(function (data) {
            var message = JSON.parse(data);
            if (message.method == 'read_photo' || message.method == 'read_certificate') {
                callbackSuccess(message.method + ': ' + atob(message.data).length + ' bytes');
            }
            else
            {
                callbackSuccess(message.method + ': ' + JSON.stringify(message.data));
            }
        }, function (error) {
            console.log("readSmartcard error: " + error);
            callbackError(error);
        });

        iMatch.write({imatch: "1.0", device: "scr", method: "power_on", params: "readKnownATRs"});
    },

    nfcButtonPressed: function() {
        app.scanPassport("####PLACE#LINE#1+2#OF#PASSPORT#MRZ#HERE####",
        function(success) {
            app.display(success);
        });
    },

    isNFCEnabled: function(callback){
        iMatch.isEnabled(function (data) {
            console.log("isNFCEnabled: " + data);
            callback(data);
        }, function (error) {
            console.log("isNFCEnabled error: " + error);
        });
    },

    /*
        read the mrtd with mrz
    */
    scanPassport: function(mrzLines, callback){
        var passportData = {};

        iMatch.subscribe(function (data) {
            var iMatchMessage = JSON.parse(data);

            if (iMatchMessage.method == 'read_bac')
            {
                if (iMatchMessage.data !== "1")
                {
                    callback('BAC failed: ' + iMatchMessage.data);
                }
            }
            else if (iMatchMessage.method == 'read_sod')
            {
            }
            else if (iMatchMessage.method == 'read_dg1')
            {
                var dg1 = atob(iMatchMessage.data).substring(3,47) + atob(iMatchMessage.data).substring(47);
                passportData = mrz.parseMRZ(dg1);
                callback(JSON.stringify(passportData));
            }
            else if (iMatchMessage.method == 'read_dg2')
            {
                jj2000.convertJJ2000(iMatchMessage.data, function(photo) {
                    var image = new Image();
                    image.addEventListener('load', function() {
                        passportData.bitmapWidth = image.width;
                        passportData.bitmapHeight = image.height;
                        passportData.bitmap = atob(iMatchMessage.data).length;
                        callback(JSON.stringify(passportData));
                    });

                    image.src = 'data:image/jpg;base64,' + photo;
                    document.body.appendChild(image);
                }, function(error) {
                    alert('photo conversion failed');
                });
            }
            else
            {
                callback('NFC.' + iMatchMessage.method + ': ' + atob(iMatchMessage.data).length + ' bytes');
            }

        }, function (error) {
            console.log("scanPassport error: " + error);
        });

        iMatch.write({imatch: "1.0", device: "nfc", method: "mrtdread", params: mrzLines});
    },

    /*
    unsubscribes from any Bluetooth serial listener and changes the button:
    */
    closePort: function() {
        // if you get a good Bluetooth serial connection:
        app.clear();
        app.display("Disconnected from: " + app.iMatchDevice.name + " - " + app.iMatchDevice.uuid);
        // change the button's name:
        connectButton.innerHTML = "Connect";
        // unsubscribe from listening:
        iMatch.unsubscribe();
    },

    /*
        appends @error to the message div:
    */
    showError: function(error) {
        app.clear();
        app.display(error);
    },

    /*
        sleep for a while:
    */
    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /*
        appends @message to the message div:
    */
    display: function(message) {
        var display = document.getElementById("message"), // the message div
            lineBreak = document.createElement("br"),     // a line break
            label = document.createTextNode(message);     // create the label

        display.appendChild(lineBreak);          // add a line break
        display.appendChild(label);              // add the message node
    },

    /*
        clears the message div:
    */
    clear: function() {
        var display = document.getElementById("message");
        display.innerHTML = "";
    }
};      // end of app
