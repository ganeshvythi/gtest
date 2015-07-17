app.controller('AppCtrl', function ($scope, $cordovaPush, $cordovaDialogs, $cordovaMedia, $cordovaToast, ionPlatform, $http) {
    $scope.notifications = [];

    // call to register automatically upon device ready
    ionPlatform.ready.then(function (device) {
        $scope.register();
    });


    // Register
    $scope.register = function () {
        var config = null;

        if (ionic.Platform.isAndroid()) {
            config = {
                "senderID": "567965334474" //"YOUR_GCM_PROJECT_ID" // REPLACE THIS WITH YOURS FROM GCM CONSOLE - also in the project URL like: https://console.developers.google.com/project/434205989073
            };
        }
        else if (ionic.Platform.isIOS()) {
            config = {
                "badge": "true",
                "sound": "true",
                "alert": "true"
            }
        }

        $cordovaPush.register(config).then(function (result) {
            console.log("Register success " + result);

            $cordovaToast.showShortCenter('Registered for push notifications');
            $scope.registerDisabled = true;
            // ** NOTE: Android regid result comes back in the pushNotificationReceived, only iOS returned here
            if (ionic.Platform.isIOS()) {
                $scope.regId = result;
                storeDeviceToken("ios");
            }
        }, function (err) {
            console.log("Register error " + err)
        });
    }

    // Notification Received
    $scope.$on('$cordovaPush:notificationReceived', function (event, notification) {
        console.log(JSON.stringify([notification]));
        if (ionic.Platform.isAndroid()) {
            handleAndroid(notification);
        }
        else if (ionic.Platform.isIOS()) {
            handleIOS(notification);
            $scope.$apply(function () {
                $scope.notifications.push(JSON.stringify(notification.alert));
            })
        }
    });

    // Android Notification Received Handler
    function handleAndroid(notification) {
        // ** NOTE: ** You could add code for when app is in foreground or not, or coming from coldstart here too
        //             via the console fields as shown.
        //$cordovaDialogs.alert(JSON.stringify(notification), "All push notification");
        console.log("In foreground " + notification.foreground + " Coldstart " + notification.coldstart);
        if (notification.event == "registered") {
            $scope.regId = notification.regid;
            storeDeviceToken("android");
        }
        else if (notification.event == "message") {
            //  $cordovaDialogs.alert(notification.message, "Push Notification Received");
            // { payload : {gcm.notification.text :'My Text',gcm.notification.body :'great match','gcm.notification.message' :'Hello 11', 
            // gcm.notification.title : 'Portugal vs Denmark'

            $cordovaDialogs.alert(JSON.stringify(notification.payload), "Push Notification Received*");
            $cordovaDialogs.alert(JSON.stringify(notification.payload["gcm.notification.message"]), JSON.stringify(notification.payload["gcm.notification.title"]));
            
            $scope.$apply(function () {
                // $scope.notifications.push(JSON.stringify(notification.message));
                $scope.notifications.push(JSON.stringify(notification.payload));
            })
        }
        else if (notification.event == "error")
            $cordovaDialogs.alert(notification.msg, "Push notification error event");
        else $cordovaDialogs.alert(notification.event, "Push notification handler - Unprocessed Event");
    }

    // IOS Notification Received Handler
    function handleIOS(notification) {
        // The app was already open but we'll still show the alert and sound the tone received this way. If you didn't check
        // for foreground here it would make a sound twice, once when received in background and upon opening it from clicking
        // the notification when this code runs (weird).
        if (notification.foreground == "1") {
            // Play custom audio if a sound specified.
            if (notification.sound) {
                var mediaSrc = $cordovaMedia.newMedia(notification.sound);
                mediaSrc.promise.then($cordovaMedia.play(mediaSrc.media));
            }

            if (notification.body && notification.messageFrom) {
                $cordovaDialogs.alert(notification.body, notification.messageFrom);
            }
            else $cordovaDialogs.alert(notification.alert, "Push Notification Received");

            if (notification.badge) {
                $cordovaPush.setBadgeNumber(notification.badge).then(function (result) {
                    console.log("Set badge success " + result)
                }, function (err) {
                    console.log("Set badge error " + err)
                });
            }
        }
            // Otherwise it was received in the background and reopened from the push notification. Badge is automatically cleared
            // in this case. You probably wouldn't be displaying anything at this point, this is here to show that you can process
            // the data in this situation.
        else {
            if (notification.body && notification.messageFrom) {
                $cordovaDialogs.alert(notification.body, "(RECEIVED WHEN APP IN BACKGROUND) " + notification.messageFrom);
            }
            else $cordovaDialogs.alert(notification.alert, "(RECEIVED WHEN APP IN BACKGROUND) Push Notification Received");
        }
    }

    // Stores the device token in a db using node-pushserver (running locally in this case)
    //
    // type:  Platform type (ios, android etc)
    function storeDeviceToken(type) {
        // Create a random userid to store with it
        var user = { user: 'user' + Math.floor((Math.random() * 10000000) + 1), type: type, token: $scope.regId };
        console.log("Post token for registered device with data " + JSON.stringify(user));
        localStorage["regId"] = JSON.stringify(user);
       /* $http.post('http://192.168.1.16:8000/subscribe', JSON.stringify(user))
            .success(function (data, status) {
                console.log("Token stored, device is successfully subscribed to receive push notifications.");
            })
            .error(function (data, status) {
                console.log("Error storing device token." + data + " " + status)
            }
        );*/
    }

    // Removes the device token from the db via node-pushserver API unsubscribe (running locally in this case).
    // If you registered the same device with different userids, *ALL* will be removed. (It's recommended to register each
    // time the app opens which this currently does. However in many cases you will always receive the same device token as
    // previously so multiple userids will be created with the same token unless you add code to check).
    function removeDeviceToken() {
        var tkn = { "token": $scope.regId };
     /*   $http.post('http://192.168.1.16:8000/unsubscribe', JSON.stringify(tkn))
            .success(function (data, status) {
                console.log("Token removed, device is successfully unsubscribed and will not receive push notifications.");
            })
            .error(function (data, status) {
                console.log("Error removing device token." + data + " " + status)
            }
        );*/
    }

    // Unregister - Unregister your device token from APNS or GCM
    // Not recommended:  See http://developer.android.com/google/gcm/adv.html#unreg-why
    //                   and https://developer.apple.com/library/ios/documentation/UIKit/Reference/UIApplication_Class/index.html#//apple_ref/occ/instm/UIApplication/unregisterForRemoteNotifications
    //
    // ** Instead, just remove the device token from your db and stop sending notifications **
    $scope.unregister = function () {
        console.log("Unregister called");
        removeDeviceToken();
        $scope.registerDisabled = false;
        //need to define options here, not sure what that needs to be but this is not recommended anyway
        //        $cordovaPush.unregister(options).then(function(result) {
        //            console.log("Unregister success " + result);//
        //        }, function(err) {
        //            console.log("Unregister error " + err)
        //        });
    }


})

.controller('MainCtrl', function ($scope, $http) {
    $scope.Show = function () {
        //  $scope.result =   localStorage.getItem("regid");

        var keyid = "APA91bGyYvW6KZOXDc2yquvc_dKv_FvtHMTFZORdeM5RUR1aoqpkJ89R2CEeBNFu1Ac6G48yYVCf9slJzagbIRTozbTOVbwXJaDceJOUAO4ETADQ6D8hul3UaXPy-ViiLCPt6s3ZqaB_lXBGVNDv5HGgwXXl-qOEzQ"
        //   keyid = "APA91bGyYvW6KZOXDc2yquvc_dKv_FvtHMTFZORdeM5RUR1aoqpkJ89R2CEeBNFu1Ac6G48yYVCf9slJzagbIRTozbTOVbwXJaDceJOUAO4ETADQ6D8hul3UaXPy-ViiLCPt6s3ZqaB_lXBGVNDv5HGgwXXl-qOEzQ";
        keyid = "APA91bHYOMmW1ipwcjsGOOm1Kle3Wc1H6JOicVeBN_PD5BsZ5muvDNPC0lNCcr0_9lLU9WaiaTs5uiIOLAXCcq7g-3wDExnn-3I-gmbdgsf4BKKPO7J9OjPzfrwbs3oakSrOriPF7ZQzBIZyoQGosAVS_v-w9vOpQA";
        var req = {
            "to": keyid, //"APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx...",
            "notification": {
                "body": "great match!",
                "title": "Portugal vs. Denmark",
                text: " My Text",
                message: "Hello 11"
            },
            // message : "Hello 1"
        };

        req = {
            "to": keyid, //"APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx...",

            "event": "message",
            "from": "219209889674",
            "collapse_key": "push",
            "foreground": true,
            "payload": {
                "message": "This is a test notification"
            },
            "notification": {
                "body": "great match**=!",
                "title": "Portugal vs. Denmark",
                text: " My Text",
                message: "Hello 11w="
            }

        } /*
       req = [{
           "message": "Tori432 commented on your photo: Awesome!",
           "payload": { "message": "Tori432 commented on your photo: Awesome!" },
           "collapse_key": "optional",
           "from": "824841663931",
           "foreground": false,
           "event": "message",
           "coldstart": false
       }]; */

        var header = { headers: { "Content-Type": "application/json", Authorization: 'key = AIzaSyD2Jp3VacvBEpEgChd3ULz35uDg76oE6rw' } };


        // $http.post('https://gcm-http.googleapis.com/gcm/send', req, header)
        $http.post('https://android.googleapis.com/gcm/send', req, header)
        .success(function (data) {
            var dt = JSON.stringify(data)
            alert(dt);
            $scope.result = dt;
        })
        .error(function (data) {
            alert("error");
            alert(JSON.stringify(data));
        })


        /*
        var gcm = require("gcm");

        // Replace this key with your GCM API key
        var sender = new gcm.Sender("AIzaSyD2Jp3VacvBEpEgChd3ULz35uDg76oE6rw");

        // Replace these Registration IDs with actual Registration IDs
        var registrationIds = [
          keyid
        ];

        var message = new gcm.Message({
            data: {
                testMessage: "This message is transmitted to the recipient device."
            }
        });

        // Actually send off the message
        sender.send(message, registrationIds, function (err, result) {
            // Handle response from server
            if (err) console.error("Something went wrong!", err);
            else console.log("Succesfully sent message. Got result", result);
        });
        */
        // var gcm = require("node-gcm");
    }

});