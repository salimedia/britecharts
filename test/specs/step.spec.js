define(['jquery', 'd3', 'step', 'stepChartDataBuilder'], function($, d3, chart, dataBuilder) {
    'use strict';

    describe('Step Chart Test Suite', () => {
        let stepChart, dataset, containerFixture, f;

        function aTestDataSet() {
            return new dataBuilder.StepDataBuilder();
        }

        beforeEach(() => {
            dataset = aTestDataSet()
                .withSmallData()
                .build();
            stepChart = chart();

            // DOM Fixture Setup
            f = jasmine.getFixtures();
            f.fixturesPath = 'base/test/fixtures/';
            f.load('testContainer.html');

            containerFixture = d3.select('.test-container');
            containerFixture.datum(dataset.data).call(stepChart);
        });

        afterEach(() => {
            containerFixture.remove();
            f = jasmine.getFixtures();
            f.cleanUp();
            f.clearCache();
        });

        it('should render a chart with minimal requirements', () => {
            expect(containerFixture.select('.step-chart').empty()).toBeFalsy();
        });

        it('should render container, axis and chart groups', () => {
            expect(containerFixture.select('g.container-group').empty()).toBeFalsy();
            expect(containerFixture.select('g.chart-group').empty()).toBeFalsy();
            expect(containerFixture.select('g.x-axis-group').empty()).toBeFalsy();
            expect(containerFixture.select('g.x-axis-label').empty()).toBeFalsy();
            expect(containerFixture.select('g.y-axis-group').empty()).toBeFalsy();
            expect(containerFixture.select('g.y-axis-label').empty()).toBeFalsy();
            expect(containerFixture.select('g.grid-lines-group').empty()).toBeFalsy();
            expect(containerFixture.select('g.metadata-group').empty()).toBeFalsy();
        });

        it('should render grid lines', () => {
            expect(containerFixture.select('.horizontal-grid-line').empty()).toBeFalsy();
        });

        it('should render an X and Y axis', () => {
            expect(containerFixture.select('.x-axis-group.axis').empty()).toBeFalsy();
            expect(containerFixture.select('.y-axis-group.axis').empty()).toBeFalsy();
        });

        it('should render a step for each data entry', () => {
            let numSteps = dataset.data.length;

            expect(containerFixture.selectAll('.step').size()).toEqual(numSteps);
        });

        describe('API', function() {

            it('should provide margin getter and setter', () => {
                let defaultMargin = stepChart.margin(),
                    testMargin = {top: 4, right: 4, bottom: 4, left: 4},
                    newMargin;

                stepChart.margin(testMargin);
                newMargin = stepChart.margin();

                expect(defaultMargin).not.toBe(newMargin);
                expect(newMargin).toBe(testMargin);
            });

            it('should provide height getter and setter', () => {
                let defaultHeight = stepChart.height(),
                    testHeight = 200,
                    newHeight;

                stepChart.height(testHeight);
                newHeight = stepChart.height();

                expect(defaultHeight).not.toBe(newHeight);
                expect(newHeight).toBe(testHeight);
            });

            it('should provide numOfVerticalTicks getter and setter', () => {
                let defaultNumOfVerticalTicks = stepChart.numOfVerticalTicks(),
                    testNumOfVerticalTicks = 20,
                    newNumOfVerticalTicks;

                stepChart.numOfVerticalTicks(testNumOfVerticalTicks);
                newNumOfVerticalTicks = stepChart.numOfVerticalTicks();

                expect(defaultNumOfVerticalTicks).not.toBe(newNumOfVerticalTicks);
                expect(newNumOfVerticalTicks).toBe(testNumOfVerticalTicks);
            });

            it('should provide width getter and setter', () => {
                let defaultWidth = stepChart.width(),
                    testWidth = 200,
                    newWidth;

                stepChart.width(testWidth);
                newWidth = stepChart.width();

                expect(defaultWidth).not.toBe(newWidth);
                expect(newWidth).toBe(testWidth);
            });

            it('should provide yAxisLabel getter and setter', () => {
                let defaultYAxisLabel = 'Hello',
                    testYAxisLabel = 'World',
                    newYAxisLabel;

                stepChart.yAxisLabel(testYAxisLabel);
                newYAxisLabel = stepChart.yAxisLabel();

                expect(defaultYAxisLabel).not.toBe(newYAxisLabel);
                expect(newYAxisLabel).toBe(testYAxisLabel);
            });

            it('should provide yAxisLabelOffset getter and setter', () => {
                let defaultYAxisLabelOffset = -40,
                    testYAxisLabelOffset = -30,
                    newYAxisLabelOffset;

                stepChart.yAxisLabelOffset(testYAxisLabelOffset);
                newYAxisLabelOffset = stepChart.yAxisLabelOffset();

                expect(defaultYAxisLabelOffset).not.toBe(newYAxisLabelOffset);
                expect(newYAxisLabelOffset).toBe(testYAxisLabelOffset);
            });

            it('should provide xAxisLabel getter and setter', () => {
                let defaultXAxisLabel = 'World',
                    testXAxisLabel = 'Hello',
                    newXAxisLabel;

                stepChart.xAxisLabel(testXAxisLabel);
                newXAxisLabel = stepChart.xAxisLabel();

                expect(defaultXAxisLabel).not.toBe(newXAxisLabel);
                expect(newXAxisLabel).toBe(testXAxisLabel);
            });

            it('should provide xAxisLabelOffset getter and setter', () => {
                let defaultXAxisLabelOffset = 30,
                    testXAxisLabelOffset = 40,
                    newXAxisLabelOffset;

                stepChart.xAxisLabelOffset(testXAxisLabelOffset);
                newXAxisLabelOffset = stepChart.xAxisLabelOffset();

                expect(defaultXAxisLabelOffset).not.toBe(newXAxisLabelOffset);
                expect(newXAxisLabelOffset).toBe(testXAxisLabelOffset);
            });
        });

        describe('when hovering a step', function() {

            it('should trigger a callback', () => {
                let step = containerFixture.select('.step:nth-child(1)');
                let callbackSpy = jasmine.createSpy('callback');

                stepChart.on('customMouseOver', callbackSpy);
                step.dispatch('mouseover');

                expect(callbackSpy.calls.count()).toBe(1);
            });
        });

        describe('Export chart functionality', () => {

            it('should have exportChart defined', () => {
                expect(stepChart.exportChart).toBeDefined();
            });
        });
    });
});
