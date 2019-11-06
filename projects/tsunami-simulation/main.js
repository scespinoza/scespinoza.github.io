// implement last() method for Arrays
Array.prototype.last = function() {
    return this[this.length - 1];
}

// Global variables for the data
let meetingPointsCollection,
    safeZoneCollection,
    edgesCollection,
    shortestPathsCollection;
// Global variables to project data
let outerBounds,
    transform,
    d3Path,
    map,
    svg,
    g;
// global variables for svg objects
let safeZonePaths,
    meetingPoints,
    householdPoints;

let simRatio;
let animating = false;
let clickedMeetingPoint;

loadMap();
loadData();
map.on('viewreset', reset)

function adjustVelocity() {
    document.getElementById("velocity-display").innerHTML = 'x' + document.getElementById("simratio-slider").value;
    simRatio = document.getElementById("simratio-slider").value;
    timerWorker.postMessage(["updateRatio", simRatio]);
}

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

function loadMap() {
    
    map = L.map('map', {
        zoomControl: false
    }).setView([-23.645377,-70.4056757], 14);
    
    var tileURL = 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    L.tileLayer(tileURL, {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(map);
    
    outerBounds = {
        type: "FeatureCollection",
        features: [
            {type: "Feature", geometry: { type: "Point", coordinates : [ -70.5587477, -23.763302 ] }},
            {type: "Feature", geometry: { type: "Point", coordinates : [ -70.327345, -23.5347237 ] }}
        ]
    }
    
    var southWest = L.latLng(-23.763302,-70.5587477),
        northEast = L.latLng(-23.5347237,-70.327345);
    
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

function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
}

function applyLatLngToLayer(d) {
    var x = d[0];
    var y = d[1];

    return map.latLngToLayerPoint(new L.LatLng(y, x));
}



function getMeetingPoint(lastPath) {
    var lastPoint = lastPath.geometry.coordinates.last().last();
    var minDist = 999999
    var nearestMeetingPoint;
    g.selectAll('circle.meeting-point').each(function(d) {
        dist = d3.geoDistance(d.geometry.coordinates, lastPoint);
        if (dist <= minDist) {
            nearestMeetingPoint = d.properties.OBJECTID;
            minDist = dist;
        }
    });
    return nearestMeetingPoint;    
}

function reset() {
    var bounds = d3Path.bounds(outerBounds),
                topLeft = bounds[0],
                bottomRight = bounds[1];


    svg.attr('width', bottomRight[0] - topLeft[0])
                .attr('height', bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

    g.attr('transform', 'translate(' + -topLeft[0] + ', ' + -topLeft[1] + ')');

    // Reproject data
    d3.selectAll('path').attr('d', d3Path);

    d3.selectAll('circle.static')
        .attr("transform", function (d) {
            if (d.shortest_path.length > 0) {
                var firstPath = d3.select("path#edge-" + d.shortest_path[0])
                var  p = firstPath.node().getPointAtLength(0);
            return 'translate(' + p.x + ', ' + p.y + ')';}
        })
    meetingPoints.attr('transform', function(d) {
        var p = applyLatLngToLayer(d.geometry.coordinates);
        return 'translate(' + p.x + ', ' + p.y + ')';
        });
}


function loadData() {
    Promise.all([
        d3.json('data/puntos_encuentro_antofa.geojson'),
        d3.json('data/safe_zone_antofagasta.geojson'),
        d3.json('data/antofa_edges.geojson'),
        d3.json('data/shortest_paths.json')
    ]).then(function(data) {
        meetingPointsCollection = data[0];
        safeZoneCollection = data[1];
        edgesCollection = data[2];
        shortestPathsCollection = data[3].slice(0, 1000);

        edgesPaths = g.selectAll("path.street")
                    .data(edgesCollection.features)
                    .enter()
                    .append("path")
                    .attr("id", function(d) {
                        return "edge-" + d.properties.id;
                    })
                    .attr("class", "street");

        safeZonePaths = g.selectAll('path.safezone')
                    .data(safeZoneCollection.features)
                    .enter()
                    .append('path')
                    .attr('class', 'safezone');

        meetingPoints = g.selectAll('circle.meeting-point')
                        .data(meetingPointsCollection.features)
                        .enter()
                        .append('circle')
                        .attr("r", 5)
                        .attr("class", "meeting-point")
                        .attr('id', function(d) {
                            return 'mp-' + d.properties.OBJECTID;
                        })
                        .on('click', function (d) {
                            meetingPointInfoController(d.properties.OBJECTID);
                        })
                        .each(function(d) {
                            d.properties.count = 0;
                        });
                       reset(); 
        loadHouseholdPoints(shortestPathsCollection);
    });                    
    
}


function loadHouseholdPoints(shortestPaths) {
    householdPoints = g.selectAll('circle.household')
                                .data(shortestPaths)
                                .enter()
                                .append("circle")
                                .attr("r", 3)
                                .attr("class", "household static")
                                .attr("transform", function (d) {
                                        if (d.shortest_path.length > 0) {
                                            var firstPath = d3.select("path#edge-" + d.shortest_path[0])
                                            var  p = firstPath.node().getPointAtLength(0);
                                        return 'translate(' + p.x + ', ' + p.y + ')';
                                        }    
                                })   
}


function animateShortestPath(circleObject, ipath) {

    var actualPathID = circleObject.datum().shortest_path[ipath];
    var actualPath = d3.select("path#edge-" + actualPathID);
    circleObject.transition()
                .duration(function () {
                    var velocity = 0.0015; // meters per ms
                    return actualPath.datum().properties.length / (velocity * simRatio);
                })
                .ease(d3.easeLinear)
                .attrTween("transform", function () {
                    return function (t) {
                        pathLength = actualPath.node().getTotalLength();
                        p = actualPath.node().getPointAtLength(t * pathLength);
                        return 'translate(' + p.x + ', ' + p.y + ')';
                    }
                })
                .on("end", function() {
                    if (ipath < circleObject.datum().shortest_path.length - 1) {
                        ipath += 1;
                        animateShortestPath(circleObject, ipath);
                    } else {
                        var meetingPointID = getMeetingPoint(actualPath.datum());
                        var thisMeetingPoint = d3.select("circle#mp-" + meetingPointID);
                        thisMeetingPoint.datum().properties.count += 1;
                        thisMeetingPoint
                            .interrupt()
                            .transition()
                            .duration(250)
                            .ease(d3.easeLinear)
                            .attr("r", 7)
                            .transition()
                            .duration(250)
                            .ease(d3.easeLinear)
                            .attr("r", 5);

                        if (clickedMeetingPoint == meetingPointID) {
                            displayMeetingPointInfo(meetingPointID);
                        }
                        d3.select(this).remove();
                            
                    }           
                })
}




function animation() {
        simRatio = document.getElementById("simratio-slider").value;
        householdPoints.transition()
                        .duration(function(d) {
                            return d.delay / simRatio;
                        })
                        .on("end", function(d) {
                            if (d.shortest_path.length > 0) {
                                d3.select(this).attr("class", "household moving");
                                animateShortestPath(d3.select(this), 0);
                            }
                            
                        });
        timerWorker.postMessage(["timerInit", simRatio]);
}

function playController() {
    if (animating) {
        d3.selectAll("circle.household")
            .interrupt()
            .attr("class", "household static")
            .attr("transform", function (d) {
                if (d.shortest_path.length > 0) {
                    var firstPath = d3.select("path#edge-" + d.shortest_path[0])
                    var  p = firstPath.node().getPointAtLength(0);
                return 'translate(' + p.x + ', ' + p.y + ')';
                }    
            });
        d3.select("button#play-controller").html("PLAY")
        animating = false;
        timerWorker.postMessage(["stopTimer", simRatio]);
    } else {
        animation();
        d3.select("button#play-controller").html("STOP")
        animating = true;
        timerWorker.postMessage(["timerInit", simRatio]);
    }
}

function displayMeetingPointInfo(meetingPointID) {
    info_saved = g.select('#mp-' + meetingPointID).datum().properties.count;
    $("#meeting-point-id").html('Meeting Point ID: ' + meetingPointID);
    $("#saved-counter").html(info_saved + ' Safe Households');
}

function meetingPointInfoController(meetingPointID) {

    if (clickedMeetingPoint == meetingPointID) {
        $("#meeting-point-id").html('');
        $("#saved-counter").html('');
        clickedMeetingPoint = undefined;
    } else {
        displayMeetingPointInfo(meetingPointID);
        clickedMeetingPoint = meetingPointID;
    }

}