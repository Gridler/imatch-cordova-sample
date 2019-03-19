var app = {
    /*
        Application constructor
    */
    initialize: function() {
        this.bindEvents();
        console.log("Starting iMatch app");
    },

    /*
        bind any events that are required on startup to listeners
    */
    bindEvents: function() {
        document.addEventListener('deviceready', app.start, false);
        connectButton.addEventListener('touchend', app.start, false);
        syncButton.addEventListener('touchend', app.sync, false);
        batteryButton.addEventListener('touchend', app.batteryButtonPressed, false);
        updateButton.addEventListener('touchend', app.updateButtonPressed, false);
        fingerButton.addEventListener('touchend', app.fingerButtonPressed, false);
        nfcButton.addEventListener('touchend', app.nfcButtonPressed, false);
        smartcardButton.addEventListener('touchend', app.smartcardButtonPressed, false);
    },

    /*
        this runs when the device is ready for user interaction
    */
    start: function() {
        // check if Bluetooth is turned on
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
        Lists BT devices in range
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
                            app.display('Connection: ' + error);
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
        get the device's firmware version and update if different to the version in the app
    */
    updateButtonPressed: function() {
        iMatch.subscribe(function (data) {
            app.display("data " + data);
            var message = JSON.parse(data);
            if (message.method === "info")
            {
                app.fastflash = message.data.fastflash;
                var version = message.data.version.substring(1, 8);
                app.display("FW: " + message.data.version);
                app.display("Fastflash: " + message.data.fastflash);

                if (version !== "1.9.4.8")
                {
                    window.resolveLocalFileSystemURL(cordova.file.applicationDirectory + "www/fw/firmware.bin",
                        function(fileEntry) {
                            fileEntry.file(function (file) {                
                                var reader = new FileReader();
                                reader.onloadend = function () {          
                                    var firmware = new Uint8Array(this.result)
                                    app.updateFirmware(firmware);
                                }
                                reader.readAsArrayBuffer(file);                
                            }, function(error) {
                                app.display("File error: " + JSON.stringify(error));
                            });   
                        }, function(error) {
                            app.display("File error: " + JSON.stringify(error));
                    });
                }
            }
            
        }, function (error) {
            console.log("getBatteryLevel error: " + error);
        });
        
        // get the firmware version running on the connected device
        iMatch.write({imatch: "1.0", device: "sys", method: "info", params: ""});
    },

    /*
        update the firmware on the device
    */
    updateFirmware: async function(firmware) {
        // calculate the CRC
        crc.initialize();
        checksum = ~~crc.calculate(firmware);

        var display = document.getElementById("message");

        if (app.fastflash) {
            // put the device in firmware update mode to start receiving raw bytes
            var res = await app.writeWithResponse({imatch: "1.0", device: "sys", method: "firmware_update", params: firmware.length + "," + checksum + ",0"});

            var bufferSize = 256;  
            for (i = 0; i < firmware.length; i += bufferSize) {
                var buffer;
                if (i + bufferSize > firmware.length) {
                    buffer = firmware.subarray(i, firmware.length);
                    i = firmware.length;
                } else {
                    buffer = firmware.subarray(i, i + bufferSize);
                }

                var binary = '';
                for (var b = 0; b < buffer.byteLength; b++) {
                    binary += String.fromCharCode(buffer[b]);
                }
                var b64Buffer = window.btoa(binary);
                
                iMatch.writeBytes(b64Buffer);  
                await app.sleep(50);
                
                var progressPercent = Math.round(i / firmware.length * 100) + '%';
                var progressDetails = '(' + i + 'B / ' + firmware.length + 'B)';
                display.innerHTML = '<progress max="' + firmware.length + '" value="' + i + '"></progress><div>' + progressPercent + ' ' + progressDetails + '</div>';
            }
            
            app.sleep(15000).then(() =>  {
                app.start();
            });
        }
        else {
            var bufferSize = 128;
            for (i = 0; i < firmware.length; i += bufferSize) {
                var buffer;
                if (i + bufferSize > firmware.length) {
                    buffer = firmware.subarray(i, firmware.length);
                    i = firmware.length;
                } else {
                    buffer = firmware.subarray(i, i + bufferSize);
                }

                var binary = '';
                for (var b = 0; b < buffer.byteLength; b++) {
                    binary += String.fromCharCode(buffer[b]);
                }
                var b64Buffer = window.btoa(binary);
                var res = await app.writeWithResponse({imatch: "1.0", device: "sys", method: "flash", params: b64Buffer});

                var progressPercent = Math.round(i / firmware.length * 100) + '%';
                var progressDetails = '(' + i + 'B / ' + firmware.length + 'B)';
                display.innerHTML = '<progress max="' + firmware.length + '" value="' + i + '"></progress><div>' + progressPercent + ' ' + progressDetails + '</div>';

                if (res.data != "AA==")
                {
                    app.display("Error: " + res);
                    return;
                }
            }

            iMatch.subscribe(function (data) {
                app.display("Firmware updated: " + data);

                // restart to load the new firmware
                iMatch.write({imatch: "1.0", device: "sys", method: "restart", params: ""});    

                app.sleep(15000).then(() =>  {
                    app.start();
                });
            }, function (error) {
                app.display("Firmware update error: " + error);
            });
            iMatch.write({imatch: "1.0", device: "sys", method: "flash_loaded", params: firmware.length + "," + checksum + ",0"});  
        }
    },

    writeWithResponse: function(message) {
        return new Promise(function (resolve) {
            iMatch.subscribe(function (response) {
                resolve(JSON.parse(response));
            }, function (error) {
                resolve(JSON.parse(error));
            });
            iMatch.write(message);    
        });
    },

    /*
        appends @error to the message div
    */
    showError: function(error) {
        app.clear();
        app.display(error);
    },

    /*
        sleep for a while
    */
    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /*
        appends @message to the message div
    */
    display: function(message) {
        var display = document.getElementById("message"), // the message div
            lineBreak = document.createElement("br"),     // a line break
            label = document.createTextNode(message);     // create the label

        display.appendChild(lineBreak);          // add a line break
        display.appendChild(label);              // add the message node
    },

    /*
        clears the message div
    */
    clear: function() {
        var display = document.getElementById("message");
        display.innerHTML = "";
    }
};      // end of app
