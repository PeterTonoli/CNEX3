'use strict';

angular.module('interfaceApp')
  .directive('entityNetwork', [ '$window', '$http', '$location', '$rootScope', '$timeout', '$routeParams', 'DataService', 'D3Service', 'configuration',
        function ($window, $http, $location, $rootScope, $timeout, $routeParams, DataService, d3s, conf) {
    return {
      templateUrl: 'views/entity-network.html',
      restrict: 'E',
      scope: {
          sizeToParent: '@'
      },
      link: function postLink(scope, element, attrs) {

          scope.highlight = false;

          // do we hide or show the embed links?
          //  if link=false we assume it's loading in an iframe
          //   or is linked to from some other site.
          scope.removeClose = false;

          scope.$on('draw-entity-graph', function() {
              scope.data = DataService.entityData;
              scope.contextNode = scope.data.datamap[DataService.currentEntity];
              scope.graphLink = $location.absUrl().replace('site', 'entity').replace('byEntity', scope.contextNode.id) + '?link=false';
              scope.iframeCode = "<iframe src='" + scope.graphLink + "' style='border:0; width: 1024; height: 90%;' seamless='true' ></iframe>";

              // construct the entity stats object
              var bytype = _.groupBy(scope.data.nodes, function(d) { return d.type; });
              scope.stats = {};
              angular.forEach(bytype, function(v, k) {
                  var color = DataService.getColor(k);
                  if (conf.mapForward[k.toLowerCase()] !== undefined) {
                      k = conf.mapForward[k.toLowerCase()];
                  }
                  var entries = _.sortBy(v, function(d) { return d.name; });
                  scope.stats[k] = {
                    'entries': entries,
                    'count': entries.length,
                    'color': color,
                  };
              });
              scope.ready = true;
              scope.drawGraph();
          })


          if ($routeParams.link === "false") {
              scope.hideLinks = true;
              scope.removeClose = true;
          }
          scope.selections = [];
          scope.selectionData = {};
          scope.showIframeCode = false;

          var sizeThePanels = function() {
              if (scope.sizeToParent === "true") {
                  var e = angular.element(element[0].parentNode);
                  scope.w = e[0].clientWidth;
                  scope.h = scope.w * 0.6;
              } else {
                  scope.w = $window.innerWidth;
                  scope.h = $window.innerHeight;
              }
              if (scope.w === $window.innerWidth && scope.h === $window.innerHeight) {
                  scope.showSidePanel = true;
                  scope.sidepanelStyle = {
                      'position': 'fixed',
                      'top': '0px',
                      'left': scope.w * 0.6 + 'px',
                      'width': scope.w * 0.4 + 'px',
                      'height': scope.h + 'px',
                      'padding': '0px 10px',
                      'background-color': 'white'
                  }
                  scope.mainpanelStyle = {
                      'position': 'fixed',
                      'top': '0px',
                      'left': '0px',
                      'width': scope.w * 0.6 + 'px',
                      'height': scope.h + 'px',
                      'background-color': 'white',
                      'padding': '0px 0px 0px 15px'
                  }
                  scope.svgWidth = scope.w * 0.6 - 15;
              } else {
                  scope.showSidePanel = false;
                  scope.mainpanelStyle = {
                      'width': scope.w + 'px',
                      'height': scope.h + 'px',
                  }
                  scope.svgWidth = scope.w;
              }

              scope.statisticsPanelStyle = {
                  'border-radius': '4px',
                  'border': 'solid 1px #ccc',
                  'background-color': 'white',
                  'padding': '15px 15px 15px 15px',
                  'overflow': 'auto',
                  'margin-top': '15px',
                  'height': scope.h - 30 + 'px'
              }

              d3.select('#entity_graph')
                .select('svg')
                .style('width', scope.svgWidth)
                .style('height', scope.h);
          }
          sizeThePanels();

          var w = angular.element($window);
          w.bind('resize', function() {
              scope.$apply(function() {
                sizeThePanels();
              })
          });

          // handle color changes
          scope.$on('colours-changed', function() {
              var nodes = d3.select('#entity_graph')
                            .selectAll('.node')
                            .data();
              d3.select('#entity_graph')
                .transition()
                .duration(500)
                .selectAll('.node')
                .attr('fill', function(d) { return DataService.getColor(d.type); } )
                .style('stroke', function(d) { return DataService.getColor(d.type); });

              angular.forEach(scope.stats, function(v,k) {
                  scope.stats[k].color = conf.types[k].color;
              });
              scope.data.types = conf.types;
          });

          scope.showDetails = function(d) {
              if (scope.selections.indexOf(d.id) === -1) {
                  // remove all landmark labels
                  d3.select('#entity_graph')
                    .selectAll('.text-landmark')
                    .remove();

                  // highlight the node
                  d3.select('#entity_graph')
                    .select('#node_' + d.id)
                    .attr('stroke', 'black')
                    .attr('fill', d.color);

                  // highlight the relevant links
                  angular.forEach(scope.selections, function(v, k) {
                      //
                      //we have to try the linkid with source and
                      //   target flipped
                      d3.select('#entity_graph')
                        .select('#link_' + v + '_' + d.id)
                        .style('stroke', 'black');
                      d3.select('#entity_graph')
                        .select('#link_' + d.id + '_' + v)
                        .style('stroke', 'black');
                  })

                  // where is the node located relative to the underlying svg
                  var coords = d3s.determineLabelPosition('#entity_graph', d);

                  d3.select('#entity_graph')
                      .select('.text-container')
                      .append('text')
                      .attr('x', coords.x)
                      .attr('y', coords.y)
                      .attr('id', 'text_' + d.id)
                      .attr('class', 'text')
                      .attr('font-size', '20px')
                      .text(d.id);

                  scope.selections.push(d.id);
                  scope.showInfoPanel = true;
                  var url = conf[conf.service] + '/entity/' + DataService.site.code + '/data?q=' + encodeURI(d.url);
                  $http.get(url).then(function(resp) {
                      scope.selectionData[d.id] = d; 
                      scope.selectionData[d.id].summnote = resp.data.summnote;
                      scope.selectionData[d.id].fullnote = resp.data.fullnote;
                  }, 
                  function() {
                  });

              } else {
                  scope.selections.splice(scope.selections.indexOf(d.id), 1);
                  delete scope.selectionData[d.id];

                  // remove the id label
                  d3.select('#entity_graph')
                    .select('#text_' + d.id)
                    .remove();

                  // remove node highlighting
                  d3.select('#entity_graph')
                    .select('#node_' + d.id)
                    .attr('stroke', d.color);

                  // remove link highlight
                  angular.forEach(scope.selections, function(v, k) {
                      // we have to try the linkid with source and
                      //   target flipped
                      d3.select('#entity_graph')
                        .select('#link_' + v + '_' + d.id)
                        .attr('stroke', '#ccc');
                      d3.select('#entity_graph')
                        .select('#link_' + d.id + '_' + v)
                        .attr('stroke', '#ccc');
                  })
              }

              if (scope.selections.length === 0) {
                  scope.reset();
              } else {
                  
                  d3.select('#entity_graph')
                    .selectAll('.link')
                    .filter(function(d) {
                        if (d3.select(this).style('stroke') === 'rgb(0, 0, 0)') {
                            var id = d3.select(this).attr('id').split('link_')[1];
                            var s = id.split('_')[0];
                            var t = id.split('_')[1];
                            if (scope.selections.indexOf(s) === -1 || scope.selections.indexOf(t) === -1) {
                                return true;
                            }
                        }
                    })
                    .style('stroke', '#ccc')
                    .style('opacity', conf.opacity.unselected);
                    
                  
                  // fade out unselected nodes
                  d3.select('#entity_graph')
                    .selectAll('.node')
                    .style('opacity', function(d) {
                        if (scope.selections.indexOf(d.id) !== -1) {
                            return conf.opacity.default;
                        } else {
                            return conf.opacity.unselected;
                        }
                    });

                  // fade out links not between selected nodes
                  d3.select('#entity_graph')
                    .selectAll('.link')
                    .style('opacity', function(d) {
                        if (d3.select(this).style('stroke') === 'rgb(0, 0, 0)') {
                            return conf.opacity.default;
                        } else {
                            return conf.opacity.unselected;
                        }
                    });
              }

              scope.multiplePanels = {
                  'activePanels': [ scope.selections.length - 1 ]
              }
          }

          scope.closeInfoPanel = function() {
              scope.showInfoPanel = false;
          }
          scope.reset = function() {
              // remove node highlight
              d3.select('#entity_graph')
                .transition()
                .duration(250)
                .selectAll('.node')
                .attr('fill', function(d) { return d.color; })
                .style('stroke', function(d) { return d.color; })
                .style('opacity', conf.opacity.default);
           
              // remove link highlight
              d3.select('#entity_graph')
                .transition()
                .duration(250)
                .selectAll('.link')
                .style('stroke', '#ccc')
                .style('opacity', conf.opacity.default);

              // remove all labels
              d3.select('#entity_graph')
                .transition()
                .duration(250)
                .selectAll('.text').remove();

              scope.selections = [];
              scope.selectionData = {};
              scope.closeInfoPanel();

              scope.labelMainEntities();
          }

          scope.centerGraph = function() {
              if (scope.force.alpha() > 0.004) {
                  $timeout(function(d) {
                      scope.centerGraph();
                  }, 200);
              } else {
                  var t = d3s.calculateTransformAndScale('#entity_graph')
                  scope.zoom.translate(t.translate).scale(t.scale);
                  d3.select('#entity_graph')
                    .selectAll('g')
                    .transition()
                    .duration(500)
                    .attr('transform', 'translate(' + t.translate + ')' + ' scale(' + t.scale + ')');
                  scope.labelMainEntities();
                  scope.relaxed = true;
              }
          }

          scope.labelMainEntities = function() {
              d3s.renderLabels('#entity_graph');
          }

          scope.drawGraph = function() {
              scope.selections = [];
              scope.selectionData = {};

              d3.select('#entity_graph').select('svg').remove();
              scope.tickCounter = 0;
              var tick = function() {
                  path.attr("d", function(d) {
                    var dx = d.target.x - d.source.x,
                        dy = d.target.y - d.source.y,
                        dr = Math.sqrt(dx * dx + dy * dy);
                    return "M" +
                        d.source.x + "," +
                        d.source.y + "A" +
                        dr + "," + dr + " 0 0,1 " +
                        d.target.x + "," +
                        d.target.y;
                  });
                  node.attr('transform', function(d) {
                    return 'translate(' + d.x + ',' + d.y + ')';
                  });

                  // we can't update on every cycle as the html
                  //  element doesn't keep up
                  scope.tickCounter += 1;
                  if (scope.tickCounter === 2) {
                      scope.tickCounter = 0;
                      scope.$apply(function() {
                          scope.total = 0.1;
                          scope.processed = scope.force.alpha();
                
                      });
                  }
              }   

              // redraw the view when zooming
              scope.redraw = function() {
                  var svg = d3.select('#entity_graph')
                              .select('.node-container');
                  svg.attr('transform', 'translate(' + d3.event.translate + ')' + ' scale(' + d3.event.scale + ')');

                  svg = d3.select('#entity_graph')
                          .select('.text-container')
                  svg.attr('transform', 'translate(' + d3.event.translate + ')' + ' scale(' + d3.event.scale + ')');
              }

              scope.zoom = d3.behavior
                             .zoom()
                             //.scale([0.6])
                             //.translate([scope.svgWidth/5, scope.h/6])
                             .scaleExtent([0,8]).on('zoom', scope.redraw);


              scope.force = d3.layout.force()
                .nodes(scope.data.nodes)
                .links(scope.data.links)
                .charge(-2000)
                .linkDistance(200)
                .linkStrength(1)
                .size([scope.svgWidth, scope.h])
                .on('tick', tick)
                .start();

              var svg = d3.select('#entity_graph')
                .append('svg')
                .attr('width', scope.svgWidth)
                .attr('height', scope.h)
                .attr('class', 'svg')
                .attr('viewBox', '0 0 ' + scope.svgWidth + ' ' + scope.h)
                .attr('preserveAspectRatio', 'xMinYMin meet')
                .call(scope.zoom)
                .append('g')
                .attr('class', 'node-container');

              // add a group for the text elements we add later
              d3.select('#entity_graph')
                .select('svg')
                .append('g')
                .attr('class', 'text-container');

              var path = svg.selectAll('.link').data(scope.force.links());
              var node = svg.selectAll('.node').data(scope.force.nodes());

              // add the links
              path.enter()
                  .append("svg:path")
                  .attr("class", "link")
                  .attr('id', function(d) {
                    return 'link_' + d.sid + '_' + d.tid;
                  });

              //draw the nodes
              node.enter()
                .append('circle')
                .attr('id', function(d) {
                    return 'node_' + d.id;
                })
                .attr('class', 'node')
                .attr('r', function(d) {
                    return d.r;
                })
                .attr('fill', function(d) {
                    return d.color;
                })
                .on('click', function(d) {
                    scope.$apply(function() {
                      scope.showDetails(d);
                    })
                });

                scope.centerGraph();
          }

          scope.close = function() {
              $rootScope.$broadcast('destroy-entity-network-view');
          }
          scope.highlightFirstOrderConnections = function () {
              scope.highlight =! scope.highlight;

              if (scope.highlight) {
                  var highlight = [];
                  highlight.push(scope.contextNode.id);

                  d3.select('#entity_graph')
                    .selectAll('.link')
                    .attr('opacity', function(d) {
                        if (d.sid === scope.contextNode.id) {
                            highlight.push(d.tid);
                            return conf.opacity.default;
                        } else if ( d.tid === scope.contextNode.id) {
                            highlight.push(d.sid);
                            return conf.opacity.default;
                        } else {
                            return conf.opacity.unselected;
                        } 
                    });
                    d3.select('#entity_graph')
                      .selectAll('.node')
                      .attr('fill', function(d) {
                          if (highlight.indexOf(d.id) !== -1) {
                              return d.color;
                          } else {
                              return '#ccc';
                          }
                      })
                      .attr('stroke', function(d) {
                          if (highlight.indexOf(d.id) !== -1) {
                              return d.color;
                          } else {
                              return '#ccc';
                          }
                      })
                      .attr('opacity', function(d) {
                          if (highlight.indexOf(d.id) !== -1) {
                              return conf.opacity.default;
                          } else {
                              conf.opacity.unselected;
                          }
                      });
              } else {
                  d3.select('#entity_graph')
                    .selectAll('.node')
                    .attr('fill', function(d) { return d.color; })
                    .attr('opacity', conf.opacity.default);
                  d3.select('#entity_graph')
                    .selectAll('.link')
                    .attr('opacity', conf.opacity.default);
              }
          }
      }
    };
  }]);
