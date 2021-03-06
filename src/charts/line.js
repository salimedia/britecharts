define(function(require){
    'use strict';

    const d3Array = require('d3-array');
    const d3Axis = require('d3-axis');
    const d3Collection = require('d3-collection');
    const d3Dispatch = require('d3-dispatch');
    const d3Ease = require('d3-ease');
    const d3Scale = require('d3-scale');
    const d3Shape = require('d3-shape');
    const d3Selection = require('d3-selection');
    const d3Transition = require('d3-transition');
    const d3TimeFormat = require('d3-time-format');

    const {exportChart} = require('./helpers/exportChart');
    const colorHelper = require('./helpers/colors');
    const timeAxisHelper = require('./helpers/timeAxis');
    const {isInteger} = require('./helpers/common');

    const {
        axisTimeCombinations,
        lineGradientId
    } = require('./helpers/constants');

    const {
        formatIntegerValue,
        formatDecimalValue,
    } = require('./helpers/formatHelpers');

    /**
     * @typedef D3Selection
     * @type {Array[]}
     * @property {Number} length            Size of the selection
     * @property {DOMElement} parentNode    Parent of the selection
     */

     /**
      * @typedef lineChartDataByTopic
      * @type {Object}
      * @property {String} topicName    Topic name (required)
      * @property {Number} topic        Topic identifier (required)
      * @property {Object[]} dates      All date entries with values for that topic (required)
      *
      * @example
      * {
      *     topicName: 'San Francisco',
      *     topic: 123,
      *     dates: [
      *         {
      *             date: '2017-01-16T16:00:00-08:00',
      *             value: 1
      *         },
      *         {
      *             date: '2017-01-16T17:00:00-08:00',
      *             value: 2
      *         }
      *     ]
      * }
      */

     /**
      * @typedef LineChartData
      * @type {Object[]}
      * @property {lineChartDataByTopic[]} dataByTopic  Data values to chart (required)
      *
      * @example
      * {
      *     dataByTopic: [
      *         {
      *             topicName: 'San Francisco',
      *             topic: 123,
      *             dates: [
      *                 {
      *                     date: '2017-01-16T16:00:00-08:00',
      *                     value: 1
      *                 },
      *                 {
      *                     date: '2017-01-16T17:00:00-08:00',
      *                     value: 2
      *                 }
      *             ]
      *         },
      *         {
      *             topicName: 'Other',
      *             topic: 345,
      *             dates: [
      *                 {...},
      *                 {...}
      *             ]
      *         }
      *     ]
      * }
      */

    /**
     * Line Chart reusable API module that allows us
     * rendering a multi line and configurable chart.
     *
     * @module Line
     * @tutorial line
     * @requires d3-array, d3-axis, d3-brush, d3-ease, d3-format, d3-scale, d3-shape, d3-selection, d3-time, d3-time-format
     *
     * @example
     * let lineChart = line();
     *
     * lineChart
     *     .aspectRatio(0.5)
     *     .width(500);
     *
     * d3Selection.select('.css-selector')
     *     .datum(dataset)
     *     .call(lineChart);
     *
     */
    return function line() {

        let margin = {
                top: 60,
                right: 30,
                bottom: 40,
                left: 70
            },
            width = 960,
            height = 500,
            aspectRatio = null,
            tooltipThreshold = 480,
            svg,
            chartWidth, chartHeight,
            xScale, yScale, colorScale,
            xAxis, xMonthAxis, yAxis,
            xAxisPadding = {
                top: 0,
                left: 15,
                bottom: 0,
                right: 0
            },
            monthAxisPadding = 28,
            tickPadding = 5,
            colorSchema = colorHelper.colorSchemas.britechartsColorSchema,
            singleLineGradientColors = colorHelper.colorGradients.greenBlueGradient,
            topicColorMap,

            forceAxisSettings = null,
            forcedXTicks = null,
            forcedXFormat = null,

            ease = d3Ease.easeQuadInOut,
            animationDuration = 1500,

            dataByTopic,
            dataByDate,

            dateLabel = 'date',
            valueLabel = 'value',
            topicLabel = 'topic',
            topicNameLabel = 'topicName',

            verticalTicks = 5,

            overlay,
            overlayColor = 'rgba(0, 0, 0, 0)',
            verticalMarkerContainer,
            verticalMarkerLine,

            verticalGridLines,
            horizontalGridLines,
            grid = null,

            baseLine,

            // extractors
            getDate = ({date}) => date,
            getValue = ({value}) => value,
            getTopic = ({topic}) => topic,
            getLineColor = ({topic}) => colorScale(topic),

            // events
            dispatcher = d3Dispatch.dispatch('customMouseOver', 'customMouseOut', 'customMouseMove');

        /**
         * This function creates the graph using the selection and data provided
         *
         * @param {D3Selection} _selection A d3 selection that represents
         *                                  the container(s) where the chart(s) will be rendered
         * @param {LineChartData} _data The data to attach and generate the chart
         */
        function exports(_selection) {
            _selection.each(function(_data) {
                ({
                    dataByTopic,
                    dataByDate
                } = cleanData(_data));

                chartWidth = width - margin.left - margin.right;
                chartHeight = height - margin.top - margin.bottom;

                buildScales();
                buildSVG(this);
                buildAxis();
                drawAxis();
                buildGradient();
                drawLines();

                if (shouldShowTooltip()) {
                    drawVerticalMarker();
                    drawHoverOverlay();
                    addMouseEvents();
                }
            });
        }

        /**
         * Adds events to the container group if the environment is not mobile
         * Adding: mouseover, mouseout and mousemove
         */
        function addMouseEvents() {
            svg
                .on('mouseover', handleMouseOver)
                .on('mouseout', handleMouseOut)
                .on('mousemove', handleMouseMove);
        }

        /**
         * Adjusts the position of the y axis' ticks
         * @param  {D3Selection} selection Y axis group
         * @return void
         */
        function adjustYTickLabels(selection) {
            selection.selectAll('.tick text')
                .attr('transform', 'translate(0, -7)');
        }

        /**
         * Formats the value depending on its characteristics
         * @param  {Number} value Value to format
         * @return {Number}       Formatted value
         */
        function getFormattedValue(value) {
            let format;

            if (isInteger(value)) {
                format = formatIntegerValue;
            } else {
                format = formatDecimalValue;
            }

            return format(value);
        }

        /**
         * Creates the d3 x and y axis, setting orientations
         * @private
         */
        function buildAxis() {
            let dataTimeSpan = yScale.domain()[1] - yScale.domain()[0];
            let yTickNumber = dataTimeSpan < verticalTicks - 1 ? dataTimeSpan : verticalTicks;
            let minor, major;

            if (forceAxisSettings === 'custom' && typeof forcedXFormat === 'string') {
                minor = {
                    tick: forcedXTicks,
                    format: d3TimeFormat.timeFormat(forcedXFormat)
                };
                major = null;
            } else {
                ({minor, major} = timeAxisHelper.getXAxisSettings(dataByDate, width, forceAxisSettings));

                xMonthAxis = d3Axis.axisBottom(xScale)
                    .ticks(major.tick)
                    .tickSize(0, 0)
                    .tickFormat(major.format);
            }

            xAxis = d3Axis.axisBottom(xScale)
                .ticks(minor.tick)
                .tickSize(10, 0)
                .tickPadding(tickPadding)
                .tickFormat(minor.format);

            yAxis = d3Axis.axisLeft(yScale)
                .ticks(yTickNumber)
                .tickSize([0])
                .tickPadding(tickPadding)
                .tickFormat(getFormattedValue);

            drawGridLines(minor.tick, yTickNumber);
        }

        /**
         * Builds containers for the chart, the axis and a wrapper for all of them
         * NOTE: The order of drawing of this group elements is really important,
         * as everything else will be drawn on top of them
         * @private
         */
        function buildContainerGroups(){
            let container = svg
              .append('g')
                .classed('container-group', true)
                .attr('transform', `translate(${margin.left},${margin.top})`);

            container
              .append('g').classed('x-axis-group', true)
              .append('g').classed('axis x', true);
            container.selectAll('.x-axis-group')
              .append('g').classed('month-axis', true);
            container
              .append('g').classed('y-axis-group axis y', true);
            container
              .append('g').classed('grid-lines-group', true);
            container
              .append('g').classed('chart-group', true);
            container
              .append('g').classed('metadata-group', true);
        }

        /**
         * Builds the gradient element to be used later
         * @return {void}
         */
        function buildGradient() {
            svg.select('.metadata-group')
              .append('linearGradient')
                .attr('id', lineGradientId)
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%')
                .selectAll('stop')
                .data([
                    {offset:'0%', color: singleLineGradientColors[0]},
                    {offset:'100%', color: singleLineGradientColors[1]}
                ])
                .enter()
              .append('stop')
                .attr('offset', ({offset}) => offset)
                .attr('stop-color', ({color}) => color)
        }

        /**
         * Creates the x and y scales of the graph
         * @private
         */
        function buildScales(){
            let minX = d3Array.min(dataByTopic, ({dates}) => d3Array.min(dates, getDate)),
                maxX = d3Array.max(dataByTopic, ({dates}) => d3Array.max(dates, getDate)),
                maxY = d3Array.max(dataByTopic, ({dates}) => d3Array.max(dates, getValue)),
                minY = d3Array.min(dataByTopic, ({dates}) => d3Array.min(dates, getValue));
            let yScaleBottomValue = Math.abs(minY) < 0 ? Math.abs(minY) : 0;

            xScale = d3Scale.scaleTime()
                .domain([minX, maxX])
                .rangeRound([0, chartWidth]);

            yScale = d3Scale.scaleLinear()
                .domain([yScaleBottomValue, Math.abs(maxY)])
                .rangeRound([chartHeight, 0])
                .nice();

            colorScale = d3Scale.scaleOrdinal()
                .range(colorSchema)
                .domain(dataByTopic.map(getTopic));

            let range = colorScale.range();
            topicColorMap = colorScale.domain().reduce((memo, item, i) => {
                memo[item] = range[i];

                return memo;
            }, {});
        }

        /**
         * Builds the SVG element that will contain the chart
         *
         * @param  {HTMLElement} container DOM element that will work as the container of the graph
         * @private
         */
        function buildSVG(container){
            if (!svg) {
                svg = d3Selection.select(container)
                  .append('svg')
                    .classed('britechart line-chart', true);

                buildContainerGroups();
            }

            svg
                .attr('width', width)
                .attr('height', height);
        }

        /**
         * Parses dates and values into JS Date objects and numbers
         * @param  {obj} dataByTopic    Raw data grouped by topic
         * @return {obj}                Parsed data with dataByTopic and dataByDate
         */
        function cleanData({dataByTopic, dataByDate}) {

            if (dataByTopic) {
                let flatData = [];

                dataByTopic.forEach((topic) => {
                    topic.dates.forEach((date) => {
                        flatData.push({
                            topicName: topic[topicNameLabel],
                            name: topic[topicLabel],
                            date: date[dateLabel],
                            value: date[valueLabel]
                        });
                    });
                });

                // Nest data by date and format
                dataByDate = d3Collection.nest()
                                .key( getDate )
                                .entries(flatData)
                                .map((d) => {
                                    return {
                                        date: new Date(d.key),
                                        topics: d.values
                                    }
                                });

                // Normalize dates in keys
                dataByDate = dataByDate.map((d) => {
                    d.date = new Date(d.date);

                    return d;
                });

                // Normalize dataByTopic
                dataByTopic.forEach(function(kv) {
                    kv.dates.forEach(function(d) {
                        d.date = new Date(d[dateLabel]);
                        d.value = +d[valueLabel];
                    });
                });

            }

            return {dataByTopic, dataByDate};
        }

        /**
         * Removes all the datapoints highlighter circles added to the marker container
         * @return void
         */
        function cleanDataPointHighlights(){
            verticalMarkerContainer.selectAll('.circle-container').remove();
        }

        /**
         * Draws the x and y axis on the svg object within their
         * respective groups
         * @private
         */
        function drawAxis(){
            svg.select('.x-axis-group .axis.x')
                .attr('transform', `translate(0, ${chartHeight})`)
                .call(xAxis);

            if (forceAxisSettings !== 'custom') {
                svg.select('.x-axis-group .month-axis')
                    .attr('transform', `translate(0, ${(chartHeight + monthAxisPadding)})`)
                    .call(xMonthAxis);
            }

            svg.select('.y-axis-group.axis.y')
                .transition()
                .ease(ease)
                .attr('transform', `translate(${-xAxisPadding.left}, 0)`)
                .call(yAxis)
                .call(adjustYTickLabels);
        }

        /**
         * Draws the line elements within the chart group
         * @private
         */
        function drawLines(){
            let lines,
                topicLine,
                maskingRectangle;

            topicLine = d3Shape.line()
                .x(({date}) => xScale(date))
                .y(({value}) => yScale(value));

            lines = svg.select('.chart-group').selectAll('.line')
                .data(dataByTopic);

            lines.enter()
              .append('g')
                .attr('class', 'topic')
              .append('path')
                .attr('class', 'line')
                .attr('d', ({dates}) => topicLine(dates))
                .style('stroke', (d) => (
                    dataByTopic.length === 1 ? `url(#${lineGradientId})` : getLineColor(d)
                ));

            lines
                .exit()
                .remove();

            // We use a white rectangle to simulate the line drawing animation
            maskingRectangle = svg.append('rect')
                .attr('class', 'masking-rectangle')
                .attr('width', width)
                .attr('height', height)
                .attr('x', 0)
                .attr('y', 0);

            maskingRectangle.transition()
                .duration(animationDuration)
                .ease(ease)
                .attr('x', width)
                .on('end', () => maskingRectangle.remove());
        }

        /**
         * Draws grid lines on the background of the chart
         * @return void
         */
        function drawGridLines(xTicks, yTicks){
            if (grid === 'horizontal' || grid === 'full') {
                horizontalGridLines = svg.select('.grid-lines-group')
                    .selectAll('line.horizontal-grid-line')
                    .data(yScale.ticks(yTicks))
                    .enter()
                        .append('line')
                        .attr('class', 'horizontal-grid-line')
                        .attr('x1', (-xAxisPadding.left - 30))
                        .attr('x2', chartWidth)
                        .attr('y1', (d) => yScale(d))
                        .attr('y2', (d) => yScale(d));
            }

            if (grid === 'vertical' || grid === 'full') {
                verticalGridLines = svg.select('.grid-lines-group')
                    .selectAll('line.vertical-grid-line')
                    .data(xScale.ticks(xTicks))
                    .enter()
                        .append('line')
                        .attr('class', 'vertical-grid-line')
                        .attr('y1', 0)
                        .attr('y2', chartHeight)
                        .attr('x1', (d) => xScale(d))
                        .attr('x2', (d) => xScale(d));
            }

            //draw a horizontal line to extend x-axis till the edges
            baseLine = svg.select('.grid-lines-group')
                .selectAll('line.extended-x-line')
                .data([0])
                .enter()
              .append('line')
                .attr('class', 'extended-x-line')
                .attr('x1', (-xAxisPadding.left - 30))
                .attr('x2', chartWidth)
                .attr('y1', height - margin.bottom - margin.top)
                .attr('y2', height - margin.bottom - margin.top);
        }

        /**
         * Draws an overlay element over the graph
         * @inner
         * @return void
         */
        function drawHoverOverlay(){
            overlay = svg.select('.metadata-group')
              .append('rect')
                .attr('class','overlay')
                .attr('y1', 0)
                .attr('y2', height)
                .attr('height', chartHeight)
                .attr('width', chartWidth)
                .attr('fill', overlayColor)
                .style('display', 'none');
        }

        /**
         * Creates the vertical marker
         * @return void
         */
        function drawVerticalMarker(){
            verticalMarkerContainer = svg.select('.metadata-group')
              .append('g')
                .attr('class', 'hover-marker vertical-marker-container')
                .attr('transform', 'translate(9999, 0)');

            verticalMarkerLine = verticalMarkerContainer.selectAll('path')
                .data([{
                    x1: 0,
                    y1: 0,
                    x2: 0,
                    y2: 0
                }])
                .enter()
              .append('line')
                .classed('vertical-marker', true)
                .attr('x1', 0)
                .attr('y1', chartHeight)
                .attr('x2', 0)
                .attr('y2', 0);
        }

        /**
         * Finds out which datapoint is closer to the given x position
         * @param  {Number} x0 Date value for data point
         * @param  {Object} d0 Previous datapoint
         * @param  {Object} d1 Next datapoint
         * @return {Object}    d0 or d1, the datapoint with closest date to x0
         */
        function findOutNearestDate(x0, d0, d1){
            return (new Date(x0).getTime() - new Date(d0.date).getTime()) > (new Date(d1.date).getTime() - new Date(x0).getTime()) ? d0 : d1;
        }

        /**
         * Extract X position on the graph from a given mouse event
         * @param  {Object} event D3 mouse event
         * @return {Number}       Position on the x axis of the mouse
         */
        function getMouseXPosition(event) {
            return d3Selection.mouse(event)[0];
        }

        /**
         * Finds out the data entry that is closer to the given position on pixels
         * @param  {Number} mouseX X position of the mouse
         * @return {Object}        Data entry that is closer to that x axis position
         */
        function getNearestDataPoint(mouseX) {
            let dateFromInvertedX = xScale.invert(mouseX);
            let bisectDate = d3Array.bisector(getDate).left;
            let dataEntryIndex = bisectDate(dataByDate, dateFromInvertedX, 1);
            let dataEntryForXPosition = dataByDate[dataEntryIndex];
            let previousDataEntryForXPosition = dataByDate[dataEntryIndex - 1];
            let nearestDataPoint;

            if (previousDataEntryForXPosition && dataEntryForXPosition) {
                nearestDataPoint = findOutNearestDate(dateFromInvertedX, dataEntryForXPosition, previousDataEntryForXPosition);
            } else {
                nearestDataPoint = dataEntryForXPosition;
            }

            return nearestDataPoint;
        }

        /**
         * MouseMove handler, calculates the nearest dataPoint to the cursor
         * and updates metadata related to it
         * @private
         */
        function handleMouseMove(){
            let xPositionOffset = -margin.left, //Arbitrary number, will love to know how to assess it
                dataPoint = getNearestDataPoint(getMouseXPosition(this) + xPositionOffset),
                dataPointXPosition;

            if (dataPoint) {
                dataPointXPosition = xScale(new Date(dataPoint.date));
                // More verticalMarker to that datapoint
                moveVerticalMarker(dataPointXPosition);
                // Add data points highlighting
                highlightDataPoints(dataPoint);
                // Emit event with xPosition for tooltip or similar feature
                dispatcher.call('customMouseMove', this, dataPoint, topicColorMap, dataPointXPosition);
            }
        }

        /**
         * MouseOut handler, hides overlay and removes active class on verticalMarkerLine
         * It also resets the container of the vertical marker
         * @private
         */
        function handleMouseOut(data){
            overlay.style('display', 'none');
            verticalMarkerLine.classed('bc-is-active', false);
            verticalMarkerContainer.attr('transform', 'translate(9999, 0)');

            dispatcher.call('customMouseOut', this, data);
        }

        /**
         * Mouseover handler, shows overlay and adds active class to verticalMarkerLine
         * @private
         */
        function handleMouseOver(data){
            overlay.style('display', 'block');
            verticalMarkerLine.classed('bc-is-active', true);

            dispatcher.call('customMouseOver', this, data);
        }

        /**
         * Creates coloured circles marking where the exact data y value is for a given data point
         * @param  {Object} dataPoint Data point to extract info from
         * @private
         */
        function highlightDataPoints(dataPoint) {
            cleanDataPointHighlights();

            // sorting the topics based on the order of the colors,
            // so that the order always stays constant
            dataPoint.topics = dataPoint.topics
                                    .filter(t => !!t)
                                    .sort((a, b) => topicColorMap[a.name] < topicColorMap[b.name]);

            dataPoint.topics.forEach(({name}, index) => {
                let marker = verticalMarkerContainer
                                .append('g')
                                .classed('circle-container', true),
                    circleSize = 12;

                marker.append('circle')
                    .classed('data-point-highlighter', true)
                    .attr('cx', circleSize)
                    .attr('cy', 0)
                    .attr('r', 5)
                    .style('stroke', topicColorMap[name]);

                marker.attr('transform', `translate( ${(- circleSize)}, ${(yScale(dataPoint.topics[index].value))} )` );
            });
        }

        /**
         * Helper method to update the x position of the vertical marker
         * @param  {Object} dataPoint Data entry to extract info
         * @return void
         */
        function moveVerticalMarker(verticalMarkerXPosition){
            verticalMarkerContainer.attr('transform', `translate(${verticalMarkerXPosition},0)`);
        }

        /**
         * Determines if we should add the tooltip related logic depending on the
         * size of the chart and the tooltipThreshold variable value
         * @return {Boolean} Should we build the tooltip?
         */
        function shouldShowTooltip() {
            return width > tooltipThreshold;
        }

        // API Methods

        /**
         * Gets or Sets the aspect ratio of the chart
         * @param  {Number} _x Desired aspect ratio for the graph
         * @return { (Number | Module) } Current aspect ratio or Line Chart module to chain calls
         * @public
         */
        exports.aspectRatio = function(_x) {
            if (!arguments.length) {
                return aspectRatio;
            }
            aspectRatio = _x;

            return this;
        };

        /**
         * Gets or Sets the colorSchema of the chart
         * @param  {String[]} _x Desired colorSchema for the graph
         * @return { colorSchema | module} Current colorSchema or Chart module to chain calls
         * @public
         */
        exports.colorSchema = function(_x) {
            if (!arguments.length) {
                return colorSchema;
            }
            colorSchema = _x;

            return this;
        };

        /**
         * Gets or Sets the dateLabel of the chart
         * @param  {Number} _x Desired dateLabel for the graph
         * @return { dateLabel | module} Current dateLabel or Chart module to chain calls
         * @public
         */
        exports.dateLabel = function(_x) {
            if (!arguments.length) {
                return dateLabel;
            }
            dateLabel = _x;

            return this;
        };

        /**
         * Exposes the ability to force the chart to show a certain x axis grouping
         * @param  {String} _x Desired format
         * @return { (String|Module) }    Current format or module to chain calls
         * @example
         *     line.forceAxisFormat(line.axisTimeCombinations.HOUR_DAY)
         */
        exports.forceAxisFormat = function(_x) {
            if (!arguments.length) {
              return forceAxisSettings;
            }
            forceAxisSettings = _x;

            return this;
        };

        /**
         * Exposes the ability to force the chart to show a certain x format
         * It requires a `forceAxisFormat` of 'custom' in order to work.
         * @param  {String} _x              Desired format for x axis
         * @return { (String|Module) }      Current format or module to chain calls
         */
        exports.forcedXFormat = function(_x) {
            if (!arguments.length) {
              return forcedXFormat;
            }
            forcedXFormat = _x;

            return this;
        };

        /**
         * Exposes the ability to force the chart to show a certain x ticks. It requires a `forceAxisFormat` of 'custom' in order to work.
         * NOTE: This value needs to be a multiple of 2, 5 or 10. They won't always work as expected, as D3 decides at the end
         * how many and where the ticks will appear.
         *
         * @param  {Number} _x              Desired number of x axis ticks (multiple of 2, 5 or 10)
         * @return { (Number|Module) }      Current number or ticks or module to chain calls
         */
        exports.forcedXTicks = function(_x) {
            if (!arguments.length) {
              return forcedXTicks;
            }
            forcedXTicks = _x;

            return this;
        };

        /**
         * Gets or Sets the grid mode.
         *
         * @param  {String} _x Desired mode for the grid ('vertical'|'horizontal'|'full')
         * @return { String | module} Current mode of the grid or Line Chart module to chain calls
         * @public
         */
        exports.grid = function(_x) {
            if (!arguments.length) {
                return grid;
            }
            grid = _x;

            return this;
        };

        /**
         * Gets or Sets the height of the chart
         * @param  {Number} _x Desired width for the graph
         * @return { (Number | Module) } Current height or Line Chart module to chain calls
         * @public
         */
        exports.height = function(_x) {
            if (!arguments.length) {
                return height;
            }
            if (aspectRatio) {
                width = Math.ceil(_x / aspectRatio);
            }
            height = _x;

            return this;
        };

        /**
         * Gets or Sets the margin of the chart
         * @param  {Object} _x Margin object to get/set
         * @return { (Number | Module) } Current margin or Line Chart module to chain calls
         * @public
         */
        exports.margin = function(_x) {
            if (!arguments.length) {
                return margin;
            }
            margin = _x;

            return this;
        };

        /**
         * Gets or Sets the minimum width of the graph in order to show the tooltip
         * NOTE: This could also depend on the aspect ratio
         * @param  {Number} _x Desired tooltip threshold for the graph
         * @return { (Number | Module) } Current tooltip threshold or Line Chart module to chain calls
         * @public
         */
        exports.tooltipThreshold = function(_x) {
            if (!arguments.length) {
                return tooltipThreshold;
            }
            tooltipThreshold = _x;

            return this;
        };

        /**
         * Gets or Sets the topicLabel of the chart
         * @param  {Number} _x Desired topicLabel for the graph
         * @return { topicLabel | module} Current topicLabel or Chart module to chain calls
         * @public
         */
        exports.topicLabel = function(_x) {
            if (!arguments.length) {
                return topicLabel;
            }
            topicLabel = _x;

            return this;
        };

        /**
         * Gets or Sets the valueLabel of the chart
         * @param  {Number} _x Desired valueLabel for the graph
         * @return { valueLabel | module} Current valueLabel or Chart module to chain calls
         * @public
         */
        exports.valueLabel = function(_x) {
            if (!arguments.length) {
                return valueLabel;
            }
            valueLabel = _x;

            return this;
        };

        /**
         * Gets or Sets the number of verticalTicks of the yAxis on the chart
         * @param  {Number} _x Desired verticalTicks
         * @return { verticalTicks | module} Current verticalTicks or Chart module to chain calls
         * @public
         */
        exports.verticalTicks = function(_x) {
            if (!arguments.length) {
                return verticalTicks;
            }
            verticalTicks = _x;

            return this;
        };

        /**
         * Gets or Sets the width of the chart
         * @param  {Number} _x Desired width for the graph
         * @return { (Number | Module) } Current width or Line Chart module to chain calls
         * @public
         */
        exports.width = function(_x) {
            if (!arguments.length) {
                return width;
            }
            if (aspectRatio) {
                height = Math.ceil(_x * aspectRatio);
            }
            width = _x;

            return this;
        };

        /**
         * Chart exported to png and a download action is fired
         * @public
         */
        exports.exportChart = function(filename, title) {
            exportChart.call(exports, svg, filename, title);
        };

        /**
         * Exposes an 'on' method that acts as a bridge with the event dispatcher
         * We are going to expose this events:
         * customMouseHover, customMouseMove and customMouseOut
         *
         * @return {module} Bar Chart
         * @public
         */
        exports.on = function() {
            let value = dispatcher.on.apply(dispatcher, arguments);

            return value === dispatcher ? exports : value;
        };

        /**
         * Exposes the constants to be used to force the x axis to respect a certain granularity
         * current options: MINUTE_HOUR, HOUR_DAY, DAY_MONTH, MONTH_YEAR
         * @example
         *     line.forceAxisFormat(line.axisTimeCombinations.HOUR_DAY)
         */
        exports.axisTimeCombinations = axisTimeCombinations;

        return exports;
    };

});
