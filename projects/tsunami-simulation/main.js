// implement last() method for Arrays
Array.prototype.last = function() {
    return this[this.length - 1];
}

// Global variables for the data
let meetingPointsCollection,
    safeZoneCollection,
    edgesCollection,
    shortestPathsCollection,
    zonesCollection;
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
// global variables for svg objects
let safeZonePaths,
    meetingPoints,
    householdPoints,
    zonesPolygons;

let simRatio;
let animating = false;
let clickedMeetingPoint;
let totalHouseholds;
let totalHouseholdsSaved;
let pieForeground;

loadMap();
loadData();
pieChart();
map.on('viewreset', reset);


function adjustVelocity() {
    document.getElementById("velocity-display").innerHTML = 'x' + document.getElementById("simratio-slider").value;
    simRatio = document.getElementById("simratio-slider").value;
    

    if (animating){
        pauseAnimation();
        timerWorker.postMessage(["updateRatio", simRatio]);
        resumeAnimation();
    } else {
        timerWorker.postMessage(["updateRatio", simRatio]);
    }
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

function getTileURL(mode){
    return 'http://{s}.basemaps.cartocdn.com/' + mode + '/{z}/{x}/{y}.png';
}

function loadMap() {
    
    map = L.map('map', {
        zoomControl: false
    }).setView([-23.645377,-70.4056757], 14);
    
    
    var tileURL = getTileURL('light_all');
    actualLayer = L.tileLayer(tileURL, {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    })

    map.addLayer(actualLayer);
    
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

function pieChart() {
    var twoPI = 2 * Math.PI;
    var height = 100;
    var width = 100;

    percFormat = d3.format(".1%");
    arc = d3.arc()
            .startAngle(0)
            .innerRadius(34)
            .outerRadius(44);
    var pieChartSVG = d3.select('#pie-chart')
                        .append("svg")
                        .attr("id", "pie-chart-svg")
                        .attr("width", "100%")
                        .attr("height", "100%");
    var meter = pieChartSVG.append("g")
                    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
    percentComplete = meter.append("text")
            .attr("text-anchor", "middle")
            .attr("id", "perc-text")
            .attr("fill", "black")
            .attr("class", "control-panel-text")
            .attr("dy", "0.3em");
                    
    meter.append("path")
                .attr("class", "pie-background")
                .attr("d", arc.endAngle(twoPI));

    pieForeground = meter.append("path")
                .attr("class", "pie-foreground");
    percentComplete.text(percFormat(0));

}
function updatePieChart(perc) {
    pieForeground.attr("d", arc.endAngle(perc * 2 * Math.PI));
    percentComplete.text(percFormat(perc));
    
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
    d3.selectAll('path.zone').attr('d', d3Path);
    d3.selectAll('path.street').attr('d', d3Path);
    d3.selectAll('path.safezone').attr('d', d3Path);

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
        d3.json('data/zones_poly.json')
    ]).then(function(data) {
        meetingPointsCollection = data[0];
        safeZoneCollection = data[1];
        edgesCollection = data[2];
        zonesCollection = data[3];

        edgesPaths = g.selectAll("path.street")
                    .data(edgesCollection.features)
                    .enter()
                    .append("path")
                    .attr("id", function(d) {
                        return "edge-" + d.properties.id;
                    })
                    .attr("class", "street")
                    .style("opacity", 0);

        safeZonePaths = g.selectAll('path.safezone')
                    .data(safeZoneCollection.features)
                    .enter()
                    .append('path')
                    .attr('class', 'safezone');
        
        zonesPolygons = g.selectAll('path.zone')
                    .data(zonesCollection.features)
                    .enter()
                    .append('path')
                    .attr('class', 'zone')
                    .style('stroke', 'black');
                    
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
        loadHouseholdPoints('all');
    });                    
    
}





function loadHouseholdPoints(zone) {
    console.log("load " + zone + " points");
    d3.selectAll('circle.household').remove();
    if (zone == "all") {
        // display all shortest_paths
        map.setView([-23.645377,-70.4056757], 14);

        d3.json('data/shortest_paths.json').then(function(collection) {

            shortestPathsCollection = collection.slice(0, 100);
            totalHouseholds = shortestPathsCollection.length;
            householdPoints = g.selectAll('circle.household')
                                    .data(shortestPathsCollection)
                                    .enter()
                                    .append("circle")
                                    .attr("r", 1)
                                    .attr("class", "household static")
                                    .attr("delayT", 0)
                                    .attr("animT", 0)
                                    .attr("ipath", 0)
                                    .attr("transform", function (d) {
                                            if (d.shortest_path.length > 0) {
                                                var firstPath = d3.select("path#edge-" + d.shortest_path[0])
                                                var  p = firstPath.node().getPointAtLength(0);
                                            return 'translate(' + p.x + ', ' + p.y + ')';
                                            }    
                                    });
        });            
    }
    else {
        switch (zone) {
            case 'north':
                map.setView([-23.53392321236, -70.39921396999831], 14);
                break;
            case 'center':
                map.setView([-23.6295932015841, -70.39165142478781], 14);
                break;
            case 'south':
                map.setView([-23.68576435581511,-70.4115506888535], 14);
                break;
        }
        d3.json('data/shortest_path_zones.json').then(function(collection) {
            shortestPathsCollection = collection;
            totalHouseholds = shortestPathsCollection[zone].length;
            householdPoints = g.selectAll('circle.household')
                                    .data(shortestPathsCollection[zone])
                                    .enter()
                                    .append("circle")
                                    .attr("r", 1)
                                    .attr("class", "household static")
                                    .attr("delayT", 0)
                                    .attr("animT", 0)
                                    .attr("ipath", 0)
                                    .attr("transform", function (d) {
                                            if (d.shortest_path.length > 0) {
                                                var firstPath = d3.select("path#edge-" + d.shortest_path[0])
                                                var  p = firstPath.node().getPointAtLength(0);
                                            return 'translate(' + p.x + ', ' + p.y + ')';
                                            }    
                                    });
        });       
    }
        
}



function animateShortestPath(circleObject, ipath) {

    var actualPathID = circleObject.datum().shortest_path[ipath];
    var actualPath = d3.select("path#edge-" + actualPathID);
    circleObject.attr("r", 2)
                .transition()
                .duration(function () {
                    var t = d3.select(this).attr("animT");
                    var velocity = 0.0015; // meters per ms
                    return( 1 - t ) * actualPath.datum().properties.length / (velocity * simRatio);
                })
                .ease(d3.easeLinear)
                .attr("animT", 1)
                .attrTween("transform", function () {
                    var thisNode = this
                    return function () {
                        var t = d3.select(thisNode).attr("animT");
                        var pathLength = actualPath.node().getTotalLength();
                        var p = actualPath.node().getPointAtLength(t * pathLength);
                        return 'translate(' + p.x + ', ' + p.y + ')';
                    }
                })
                .on("end", function() {
                    if (ipath < circleObject.datum().shortest_path.length - 1) {
                        ipath += 1;
                        d3.select(this).attr("animT", 0);
                        d3.select(this).attr("ipath", ipath);
                        animateShortestPath(circleObject, ipath);
                    } else {
                        var meetingPointID = getMeetingPoint(actualPath.datum());
                        var thisMeetingPoint = d3.select("circle#mp-" + meetingPointID);
                        thisMeetingPoint.datum().properties.count += 1;
                        totalHouseholdsSaved += 1;
                        updatePieChart(totalHouseholdsSaved / totalHouseholds);
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
                        if (allHouseholdsSaved()) {
                            timerWorker.postMessage(["stopTimer", simRatio]);
                            var zone = document.getElementById("zone-selector").value;
                            loadHouseholdPoints(zone);
                        }
                            
                    }           
                });
}

function pauseAnimation() {
    animating = false;
    householdPoints.interrupt()
    d3.selectAll(".household.moving").attr("class", "household paused");
    timerWorker.postMessage(["pauseTimer", simRatio]);
}

function resumeAnimation() {
    animating = true;
    d3.selectAll(".household.paused").attr("class", "household.moving");
    householdPoints.transition()
                    .attr("delayT", 1)
                    .duration(function(d){
                        return (1-d3.select(this).attr("delayT"))*d.delay/simRatio;
                        }
                    ).on("end", function(d) {
                    if (d.shortest_path.length > 0) {
                        d3.select(this).attr("class", "household moving");
                        animateShortestPath(d3.select(this), parseInt(d3.select(this).attr("ipath")));
                    }
                });
}


function allHouseholdsSaved() {
    return totalHouseholdsSaved == totalHouseholds;
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

function pauseResumeController() {
    if (animating) {
        pauseAnimation();
        d3.select("button#pause-controller").html("RESUME");
    } else {
        resumeAnimation();
        d3.select("button#pause-controller").html("PAUSE");
    }
    
}

function animation() {
        simRatio = document.getElementById("simratio-slider").value;
        totalHouseholdsSaved = 0;
        householdPoints.transition()
                        .duration(function(d) {
                            return d.delay / simRatio;
                        })
                        .attr("delayT", 1)
                        .on("end", function(d) {
                            if (d.shortest_path.length > 0) {
                                d3.select(this).attr("class", "household moving");
                                animateShortestPath(d3.select(this), 0);
                            }
                            
                        });
        
}

function changeColor(darkMode) {
    if(darkMode){
        d3.select("body").style("color", "white").style("border-color", "white");
        d3.select("#play-controller").style("color", "white").style("border-color", "white");
        d3.select("#simratio-slider").attr("class", "slider-dark");
        d3.select("#zone-selector").style("border-color", "white").style("color", "white");
        d3.selectAll(".zone").style("stroke", "white");
        percentComplete.attr("fill", "white");
    }else{
        d3.select("body").style("color", "black").style("border-color", "black");
        d3.select("#play-controller").style("color", "black").style("border-color", "black");
        d3.select("#simratio-slider").attr("class", "slider-light");
        d3.select("#zone-selector").style("border-color", "black").style("color", "black");
        d3.selectAll(".zone").style("stroke", "black");
        percentComplete.attr("fill", "black");
    }
}

function showStreets(item) {
    if (item.checked) {
        d3.selectAll(".street")  
            .style("opacity", 0.3);
    } else {
        d3.selectAll(".street")   
                .style("opacity", 0);
    }
}


function updateMap(item) {
    if (item.id == 'dark-check-box') {
        changeColor(item.checked);
    }
    var darkMode = document.getElementById("dark-check-box").checked;
    var hideNames = document.getElementById("names-check-box").checked;

    var mode = ""

    if (darkMode)  {
        mode += "dark";
    } else {
        mode += "light";
    }
    if (!hideNames) {
        mode += "_all";
    } else {
        mode += "_nolabels"
    }
    tileURL = getTileURL(mode);
    newLayer = L.tileLayer(tileURL, {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    })
    map.removeLayer(actualLayer);
    map.addLayer(newLayer);
    actualLayer = newLayer;


}