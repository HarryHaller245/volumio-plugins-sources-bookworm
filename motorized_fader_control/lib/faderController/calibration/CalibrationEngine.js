const CalibrationError = require('../errors')

class CalibrationEngine {
  constructor(controller) {
    this.controller = controller;
    this.config = controller.config;
  }

  async runCalibration(indexes) {
    try {
      if (!Array.isArray(indexes) || indexes.length === 0) {
        const error = new Error('Invalid calibration indexes - must be a non-empty array');
        this.config.logger.error(`CALIBRATION ERROR: ${error.message}`, { indexes });
        throw Object.assign(error, {
          code: 'INVALID_INPUT',
          indexes
        });
      }

      const testParams = this.config.calibrationConfig;
      const testSpeeds = this.generateTestSpeeds(testParams);

      this.config.logger.info(`=== STARTING CALIBRATION ===`);
      this.config.logger.info(`Faders: ${indexes.join(', ')}`);
      this.config.logger.info(`Testing speeds: ${testSpeeds.join(', ')}`);
      this.config.logger.info(`Testing resolutions: ${testParams.resolutions.join(', ')}`);

      const calibrationResults = {};
      const logTable = [];

      for (const index of indexes) {
        try {
          calibrationResults[index] = {};
          const fader = this.controller.getFader(index);

          for (const resolution of testParams.resolutions) {
            try {
              calibrationResults[index][resolution] = {};
              this.config.logger.info(`Testing Fader ${index} at resolution ${resolution}`);

              for (const speed of testSpeeds) {
                const runTimes = [];
                const statistics = [];

                const onMoveComplete = (faderIndex, info) => {
                  if (faderIndex === index && info.statistics) {
                    statistics.push(...info.statistics);
                  }
                };

                this.controller.on('move/complete', onMoveComplete);

                try {
                  await this.performCalibrationRuns(index, speed, resolution, testParams, runTimes);
                  this.logStatistics(index, resolution, speed, runTimes, statistics, calibrationResults, logTable);
                } catch (err) {
                  this.config.logger.error(`Error during calibration run for Fader ${index}, Resolution ${resolution}, Speed ${speed}: ${err.message}`);
                  throw err;
                } finally {
                  this.controller.off('move/complete', onMoveComplete);
                }
              }
            } catch (err) {
              this.config.logger.error(`Error during resolution testing for Fader ${index}, Resolution ${resolution}: ${err.message}`);
              throw err;
            }
          }

          const optimal = this.calculateOptimalSettings(calibrationResults[index]);
          fader.speedFactor = optimal.speedFactor;
          fader.optimalResolution = optimal.resolution;

          this.config.logger.info(`Fader ${index} calibration complete:`);
          this.config.logger.info(`- Optimal resolution: ${optimal.resolution}`);
          this.config.logger.info(`- Speed factor: ${optimal.speedFactor.toFixed(2)}`);
        } catch (err) {
          this.config.logger.error(`Error during calibration for Fader ${index}: ${err.message}`);
          throw err;
        }
      }

      this.printCalibrationTable(logTable);
      this.controller.emit('calibration', calibrationResults);

      return calibrationResults;
    } catch (err) {
      this.config.logger.error(`Calibration process failed: ${err.message}`);
      throw err;
    }
  }

  generateTestSpeeds(testParams) {
    try {
      const speedStep = (testParams.endSpeed - testParams.startSpeed) / (testParams.calibrationCount - 1);
      return Array.from({ length: testParams.calibrationCount }, (_, i) =>
        Math.round(testParams.startSpeed + i * speedStep)
      );
    } catch (err) {
      this.config.logger.error(`Error generating test speeds: ${err.message}`);
      throw err;
    }
  }

  async performCalibrationRuns(index, speed, resolution, testParams, runTimes) {
    try {
      for (let i = 0; i < testParams.warmupRuns; i++) {
        await this.controller.runCalibrationMove(
          index,
          testParams.startProgression,
          testParams.endProgression,
          speed,
          resolution
        );
      }

      for (let i = 0; i < testParams.measureRuns; i++) {
        const duration = await this.controller.runCalibrationMove(
          index,
          testParams.startProgression,
          testParams.endProgression,
          speed,
          resolution
        );
        runTimes.push(duration);
        this.config.logger.info(`Run ${i + 1}: ${duration}ms`);
      }
    } catch (err) {
      this.config.logger.error(`Error during calibration runs for Fader ${index}, Speed ${speed}, Resolution ${resolution}: ${err.message}`);
      throw err;
    }
  }

  logStatistics(index, resolution, speed, runTimes, statistics, calibrationResults, logTable) {
    try {
      const avgTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
      const variance = runTimes.reduce((a, b) => a + Math.pow(b - avgTime, 2), 0) / runTimes.length;
      const stdDev = Math.sqrt(variance);
      const effectiveSpeed = (this.config.calibrationConfig.endProgression - this.config.calibrationConfig.startProgression) / (avgTime / 1000);

      calibrationResults[index][resolution][speed] = {
        runTimes,
        avgTime,
        stdDev,
        effectiveSpeed,
        statistics
      };

      logTable.push({
        Fader: index,
        Resolution: resolution,
        Speed: speed,
        'Avg Time (ms)': Math.round(avgTime),
        'Std Dev (ms)': stdDev.toFixed(1),
        'Effective Speed (units/s)': effectiveSpeed.toFixed(1)
      });
    } catch (err) {
      this.config.logger.error(`Error logging statistics for Fader ${index}, Resolution ${resolution}, Speed ${speed}: ${err.message}`);
      throw err;
    }
  }

  calculateOptimalSettings(faderData) {
    try {
      let bestResolution = 1;
      let bestConsistency = Infinity;

      for (const [resolution, data] of Object.entries(faderData)) {
        const avgStdDev = Object.values(data).reduce((sum, test) => sum + (test.stdDev || 0), 0) / Object.keys(data).length;
        if (avgStdDev < bestConsistency) {
          bestConsistency = avgStdDev;
          bestResolution = Number(resolution);
        }
      }

      const refSpeed = 100;
      if (!faderData[bestResolution] || !faderData[bestResolution][refSpeed]) {
        this.config.logger.error(`CALIBRATION ERROR: Missing data for resolution ${bestResolution} and speed ${refSpeed}`);
        throw new CalibrationError(`Missing calibration data for resolution ${bestResolution} and speed ${refSpeed}`);
      }

      const effectiveSpeed = faderData[bestResolution][refSpeed].effectiveSpeed;
      const speedFactor = refSpeed / effectiveSpeed;

      return {
        resolution: bestResolution,
        speedFactor,
        consistency: bestConsistency
      };
    } catch (err) {
      this.config.logger.error(`Error calculating optimal settings: ${err.message}`);
      throw err;
    }
  }

  printCalibrationTable(data) {
    try {
      const columns = [
        { field: 'Fader', title: 'Fader' },
        { field: 'Resolution', title: 'Resolution' },
        { field: 'Speed', title: 'Speed %' },
        { field: 'Avg Time (ms)', title: 'Avg Time (ms)' },
        { field: 'Std Dev (ms)', title: '±Dev' },
        { field: 'Effective Speed (units/s)', title: 'Speed (u/s)' }
      ];

      const widths = columns.map(col => {
        const headerWidth = col.title.length;
        const contentWidth = Math.max(...data.map(row => String(row[col.field]).length));
        return Math.max(headerWidth, contentWidth) + 2;
      });

      let header = '';
      columns.forEach((col, i) => {
        header += col.title.padEnd(widths[i]);
      });
      this.config.logger.info(`${header}`);
      this.config.logger.info(`${'-'.repeat(header.length)}`);

      data.forEach(row => {
        let line = '';
        columns.forEach((col, i) => {
          line += String(row[col.field]).padEnd(widths[i]);
        });
        this.config.logger.info(`${line}`);
      });
    } catch (err) {
      this.config.logger.error(`Error printing calibration table: ${err.message}`);
      throw err;
    }
  }
}

module.exports = CalibrationEngine;