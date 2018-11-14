/*global cordova*/
module.exports = {

    convertJJ2000: function (data, success, failure) {
        cordova.exec(success, failure, "JJ2000", "convertJJ2000", [data]);
    }

}