/*
    We should start designing some kind of headers 
    for the files.

    simTime.js
    -----------
    Script intended to be run as a worker that holds the time engine
    for a D3 visualization.
*/

let totalSimMillis, lastMillis, simRatio;
let mainClockInterval;

// Listener expecting an Array with first elements
// a string and the rest parameters
self.addEventListener('message', function (event) {

    function IntervalFunction() {
        var now = new Date;
        var nowMillis = now.getTime();
        totalSimMillis += (nowMillis - lastMillis) * simRatio;
        lastMillis = nowMillis;
        var returnStr = ('0' + Math.floor(totalSimMillis / 60000)).slice(-2) + ':' +
            ('0' + Math.floor((totalSimMillis % 60000) / 1000)).slice(-2);
        self.postMessage(["timerUpdate", returnStr]);
    }
    
    data = event.data;

    if (data[0] === "timerInit") {
        var clock = new Date;
        lastMillis = clock.getTime();
        totalSimMillis = 0;

        simRatio = data[1];

        // Maybe every 100ms is overkill
        mainClockInterval = setInterval(IntervalFunction, 100);
    } else if (data[0] === "updateRatio") {
        simRatio = data[1];
    } else if (data[0] === "stopTimer") {
        clearInterval(mainClockInterval);
        mainClockInterval = null;
        self.postMessage(["timerUpdate", "00:00"]);
    } else if (data[0] === "continueTimer") {
        if (mainClockInterval == null) {
            mainClockInterval = setInterval(IntervalFunction, 100);
        }
    } else if (data[0] === "killTimer") {
        self.close();
    }
});

