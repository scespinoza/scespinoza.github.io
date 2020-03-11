
// Global variables to project data
let newLayer,
    actualLayer,
    outerBounds,
    transform,
    arc,
    d3Path,
    percFormat,
    map,
    svg,
    g;

let simRatio = 1000;
loadMap();
loadData();
reset();
map.on('zoom', reset);
map.on('viewreset', reset);


// -- Worker script test --
//Testing if the browser supports workers
if (typeof (Worker) !== "undefined") {
    var timerWorker = new Worker("simTime.js");
} else {
    //  TODO Stop everything because it's not gonna work
    //  as intended.
}

timerWorker.addEventListener("message", function (event) {
    data = event.data;
    if (data[0] === "timerUpdate") {
        $("#timer").html(data[1]);
    } else if (data[0] == 'stopTimer') {
        $("#timer").html(data[1]);
    }
});

function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
}

function applyLatLngToLayer(d) {
    var x = d[0];
    var y = d[1];

    return map.latLngToLayerPoint(new L.LatLng(y, x));
}

function loadMap() {

    map = L.map('map', {
        zoomControl: false
    }).setView([30.2732036,-97.743432], 13);
    
    
    var tileURL = getTileURL('light_all');
    actualLayer = L.tileLayer(tileURL, {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    })

    map.addLayer(actualLayer);
    
    outerBounds = {
        type: "FeatureCollection",
        features: [
            {type: "Feature", geometry: { type: "Point", coordinates : [ -98.3006562, 29.9764176 ] }},
            {type: "Feature", geometry: { type: "Point", coordinates : [ -97.253015, 30.628232 ] }}
        ]
    }
    
    var southWest = L.latLng(29.9764176,-98.3006562),
        northEast = L.latLng(30.628232,-97.253015);
    
    var bounds = L.latLngBounds(southWest, northEast);
    
    map.setMaxBounds(bounds);
    map.on('drag', function() {
        map.panInsideBounds(bounds, { animate: false });
    });
    // Overlay SVG
    svg = d3.select(map.getPanes().overlayPane).append("svg");
    g = svg.append("g").attr("class", "leaflet-zoom-hide");
    
    transform = d3.geoTransform({
        point: projectPoint
    });
    
    d3Path = d3.geoPath().projection(transform);
}


function getTileURL(mode){
    return 'http://{s}.basemaps.cartocdn.com/' + mode + '/{z}/{x}/{y}.png';
}


function reset() {

    console.log("Reset");
    var bounds = d3Path.bounds(outerBounds),
                topLeft = bounds[0],
                bottomRight = bounds[1];


    svg.attr('width', bottomRight[0] - topLeft[0])
                .attr('height', bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

    d3.selectAll('path').attr('d', d3Path);

    g.attr('transform', 'translate(' + -topLeft[0] + ', ' + -topLeft[1] + ')');

}

let edgesCollection,
    tripsCollection,
    nodesCollection;

function loadData() {

    Promise.all([
        d3.json('data/edges.geojson'),
        d3.json('data/nodes.geojson'),
        d3.json('data/test.json')
    ])
   .then(function (data) {
        edgesCollection = data[0];
        nodesCollection = data[1];
        tripsCollection = data[2];
        console.log("Done");
    });
    
}

function animateAllTrips() {
    Promise.all([
        locateScooters()
    ]).then(function(data) {
    var q = d3.queue();
    scooterLocations = data[0]
    trips = tripsCollection.trips;
    
    //trips = [tripsCollection.trips[2]];
    q.defer(startTimer);
    trips.forEach(function (trip) {
        if (trip.walk.length == 0) {
            q.defer(animateUnsatisfiedRequest, trip.origin, trip.arrival_time);
        }
        else if (trip.ride.length == 0) {
            shortestPathWalk =[]
            trip.walk.forEach(function(osmid) {
                shortestPathWalk.push(edgesCollection.features.find(edge => edge.properties.osmid == osmid));
            });
            q.defer(animateWalk, shortestPathWalk, 0, trip.arrival_time);
            q.defer(animateUnsatisfiedRequest, trip.pickup_node, trip.pickup_time);
        } else {
            q.defer(animateTrip,trip, trip.arrival_time);
        }
        
    });
    });
    
}

function startTimer (callback) {
    setTimeout(function() {
        timerWorker.postMessage(["timerInit", simRatio]);
        callback();
    }, 0);
}

function animateWalkDeferred(path, ipath, delay, callback) {
    setTimeout(function () {
        animateWalk(path, ipath, 0);
        callback(null);
    }, delay * 1000 / simRatio);
}

function animateUnsatisfiedRequest(osmid, delay, callback) {
    setTimeout(function() {
        node = nodesCollection.features.find(node => node.properties.osmid == osmid);
    
        g.selectAll('circle.unsatisfied-requests')
            .data([node])
            .enter()
            .append("circle")
            .attr("class", "unsatisfied-request")
            .attr("r", 0)
            .attr("transform", function(d) {
                var p = applyLatLngToLayer(d.geometry.coordinates);
                return 'translate(' + p.x + ', ' + p.y + ')';
            })
            .transition()
            .delay(0)
            .duration(2000)
            .ease(d3.easeLinear)
            .attr("r", 7)
            .style("opacity", 0)
            .on("end", function() {
                d3.select(this).remove()
            })

        callback(null);
    }, delay * 1000 / simRatio);
    
}

function locateScooters() {
    return new Promise(function (resolve, reject) {
        d3.json('data/scooter_locations.json').then(function (scootersCollection){
            var scooterLocations = nodesCollection.features.filter(node => scootersCollection.includes(node.properties.osmid));
            g.selectAll('circle')
                .data(scooterLocations)
                .enter()
                .append("circle")
                .attr("r", 2)
                .attr("class", "static-scooter")
                .attr("id", function(d) {
                    return "scooter-" + (scootersCollection.indexOf(d.properties.osmid) + 1);
                })
                .attr("transform", function (d) {
                    var p = applyLatLngToLayer(d.geometry.coordinates);
                    return 'translate(' + p.x + ', ' + p.y + ')';
                });
            resolve(scooterLocations)
        }) 
    })
   
}
function animateTrip(trip, delay, callback)  {

    setTimeout(function () {
    shortestPathWalk =[]
    trip.walk.forEach(function(osmid) {
        shortestPathWalk.push(edgesCollection.features.find(edge => edge.properties.osmid == osmid));
    })

    
    
    shortestPathRide =[]
    trip.ride.forEach(function(osmid) {
        shortestPathRide.push(edgesCollection.features.find(edge => edge.properties.osmid == osmid));
    })

    scooter = trip.scooter;
    ride_delay = trip.pickup_time - trip.arrival_time;
    animateWalk(shortestPathWalk, 0, 0);
    animateRide(shortestPathRide, 0, ride_delay, scooter);
    callback(null);
    }, delay * 1000 / simRatio)
    
}

function animateWalk(path, ipath, delay)  {
    var currentEdge = path[ipath];
    var edge = g.append("path")
                .attr("id", function () {
                    return "edge-" + currentEdge.properties.osmid;
                })
                .attr("class", "walk")
                .attr("d", function(){
                    return d3Path(currentEdge.geometry);
                });
    var circle = g.append("circle")
                    .attr("class", "user")
                    .transition()
                    .delay(function() {
                        return 1000 * delay / simRatio;
                    })
                    .duration(function() {
                        var velocity = 1.5;
                        return (1000 * currentEdge.properties.length / velocity) / simRatio;
                    })
                    .ease(d3.easeLinear)
                    .attrTween("transform", function () {
                        return function(t) {
                            var pathLength = edge.node().getTotalLength();
                            var p = edge.node().getPointAtLength(t * pathLength);
                            return 'translate(' + p.x + ', ' + p.y + ')';
                        }

                    })
                    .on("start", function() {
                        console.log("animating walk");
                        d3.select(this).attr("r", 3);
                    })
                    .on("end", function () {
                        d3.select(this).remove()                        
                        d3.select("path#edge-" + currentEdge.properties.osmid).remove()
                        if (ipath < path.length - 1) {
                            animateWalk(path, ipath + 1, 0);
                        }
                    
                    })
}


function animateRide(path, ipath, delay, scooter) {
    
    var currentEdge = path[ipath];
    
    var edge = g.append("path")
                .attr("id", function () {
                    return "edge-" + currentEdge.properties.osmid;
                })
                .attr("class", "walk")
                .attr("d", function(){
                    return d3Path(currentEdge.geometry);
                });
    
    var circle = g.select("circle#scooter-" + scooter)
    circle.transition()
                    .delay(function() {
                        return 1000 * delay / simRatio;
                    })
                    .duration(function() {
                        var velocity = 5;
                        return (1000 * currentEdge.properties.length / velocity) / simRatio;
                    })
                    .ease(d3.easeLinear)
                    .attrTween("transform", function () {
                        return function(t) {
                            var pathLength = edge.node().getTotalLength();
                            var p = edge.node().getPointAtLength(t * pathLength);
                            return 'translate(' + p.x + ', ' + p.y + ')';
                        }

                    })
                    .on("start", function() {
                        d3.select(this).attr("class", "scooter");
                    })
                    .on("end", function () {                     
                        d3.select("path#edge-" + currentEdge.properties.osmid).remove()
                        if (ipath < path.length - 1) {
                            animateRide(path, ipath + 1, 0, scooter);
                        } else {
                            d3.select("circle#scooter-" + scooter)
                                .attr("class", "static-scooter")
                        }
                    
                    })
}

function animateShortestPath(shortestPath, ipath, pathClass, delay, scooter) {
    
    var currentEdge = shortestPath[ipath];
    
    var edge = g.append("path")
                .attr("id", function () {
                    return "edge-" + currentEdge.properties.osmid;
                })
                .attr("class", pathClass)
                .attr("d", function(){
                    return d3Path(currentEdge.geometry);
                })
    
   
        var circle = g.append("circle")
                .transition()
                .delay(function() {
                    return 1000 * delay;
                })
                .duration(function() {
                    if (pathClass == "walk") {
                        velocity = 1.5;
                    } else {
                        velocity = 5;
                    }
                    return (1000 * currentEdge.properties.length / velocity) / simRatio;
                })
                .ease(d3.easeLinear)
                .attrTween("transform", function () {
                    return function(t) {
                        var pathLength = edge.node().getTotalLength();
                        var p = edge.node().getPointAtLength(t * pathLength);
                        return 'translate(' + p.x + ', ' + p.y + ')';
                    }

                })
                .on("start", function() {
                    d3.select(this).attr("r", 3)
                        .attr("class", function() {
                        if (pathClass == "walk") {
                            return "user";
                        } else {
                            return "scooter";
                        }
                    });
                })
                .on("end", function () {
                    
                    
                    if (ipath < shortestPath.length - 1) {
                        animateShortestPath(shortestPath, ipath + 1, pathClass, 0, scooter);
                    } else {
                        
                        g.select("circle#scooter-" + scooter)
                            .attr("transform", function (){
                        
                                return d3.select(this).attr("transform")}
                                );
                    }
                    d3.select(this).remove()
                    d3.select("path#edge-" + currentEdge.properties.osmid).remove()
                   
                })
    
}
