/**
 * FaderController Class
 * 
 * The FaderController class manages motorized faders, MIDI communication, calibration routines, 
 * and event-driven interactions. It serves as the core controller for interfacing with motorized 
 * faders, enabling precise control, feedback tracking, and configuration management.
 * 
 * Features:
 * - Motorized fader control with configurable movement speeds, progression maps, and echo modes.
 * - MIDI communication for fader movements, touch events, and feedback tracking.
 * - Advanced and basic calibration routines for accurate fader operation.
 * - Event emission for fader interactions, configuration changes, errors, and MIDI input.
 * - Queue management for MIDI messages with mutex locking and overflow handling.
 * - Serial port communication for hardware interfacing.
 * - Configurable logging for debugging and monitoring fader operations.
 * 
 * Emitted Events:
 * - 'touch'(index, faderInfo): Fader touched.
 * - 'untouch'(index, faderInfo): Fader released.
 * - 'move'(index, faderInfo): Fader position changed.
 * - 'error'(Error): Critical failure.
 * - 'midi'(rawData): Raw MIDI input received.
 * - 'ready': Fader controller is ready.
 * - 'configChange'(index, config): Fader configuration changed.
 * - 'calibration'(index, calibrationData): Fader calibration data.
 * 
 * Constructor:
 * @param {Object} config - Configuration object.
 * @param {Object} config.logger - Logger instance for debugging and monitoring.
 * @param {Boolean} config.MIDILog - Enable/disable MIDI message logging.
 * @param {Boolean} config.ValueLog - Enable/disable value logging.
 * @param {Boolean} config.MoveLog - Enable/disable movement logging.
 * @param {Number} config.messageDelay - Delay between MIDI messages.
 * @param {Array} config.speeds - Default movement speeds.
 * @param {Array} config.faderIndexes - Array of fader indexes to manage.
 * @param {Number} config.queueOverflow - Maximum number of messages in the queue.
 * @param {Boolean} config.calibrateOnStart - Perform calibration on startup.
 * @param {Boolean} config.feedback_midi - Enable MIDI feedback tracking.
 * @param {Number} config.feedback_tolerance - Tolerance for feedback tracking.
 * @param {Boolean} config.disableInternalEventLogging - Disable internal event logging.
 * @param {Boolean} config.disableEventLogging - Disable all event logging.
 * @param {Object} config.calibrationConfig - Configuration for calibration routines.
 * 
 * Methods:
 * - Initialization:
 *   - logConfig(): Logs the current configuration and fader information.
 *   - setupSerial(serialConfig): Sets up the serial port for communication.
 *   - start(): Starts the fader controller, initializes MIDI device, and performs calibration if enabled.
 *   - stop(): Stops the fader controller and closes the serial port.
 * 
 * - Fader Management:
 *   - createFaders(): Creates fader instances based on the configured indexes.
 *   - getFader(index): Retrieves a fader instance by its index.
 *   - setFaderTrim(index, min, max): Sets the progression map for a fader.
 *   - setFaderProgressionMap(index, range): Sets the progression map for a specific fader.
 *   - setFadersMovementSpeedFactor(index, speedFactor): Adjusts the movement speed factor for a fader.
 *   - setFaderEchoMode(index, echoMode): Enables or disables echo mode for a fader.
 * 
 * - MIDI Handling:
 *   - initMIDIState(): Initializes the MIDI state.
 *   - handleMIDIMessage(message): Processes incoming MIDI messages.
 *   - handleSysExFeedback(message): Handles SysEx feedback messages.
 *   - handleFaderMove(message): Processes fader movement messages.
 *   - handleTouch(message): Handles touch events for faders.
 *   - cacheMIDIStatus(data): Caches MIDI status messages.
 *   - checkMIDIDeviceReady(maxAttempts): Checks if the MIDI device is ready.
 * 
 * - Movement Control:
 *   - moveFaders(move, interrupt, disableFeedback): Moves faders to specified positions with configurable options.
 *   - calculateEffectiveSpeed(requestedSpeed, speedFactor, currentPos, targetPos): Calculates the effective speed for fader movement.
 *   - calculateMovements(movements): Calculates movement positions for faders.
 *   - sendPositions(positions, options): Sends fader positions to the MIDI queue for processing.
 *   - reset(indexes): Resets faders to their default positions.
 *   - combineMoves(moves): Combines multiple fader moves into a single move.
 * 
 * - Calibration:
 *   - advancedCalibration(indexes): Performs advanced calibration using the CalibrationEngine.
 *   - runCalibrationMove(index, StartProgression, EndProgression, speed, resolution): Executes a calibration move for a specific fader.
 *   - calibrate(indexes): Performs basic calibration for the specified faders.
 *   - testCalibrationMoves(indexes, speed_up, speed_down, resolution): Tests calibration moves for specified faders.
 * 
 * - Utilities:
 *   - clearQueue(indexes): Clears the MIDI queue for specified fader indexes.
 *   - closeSerial(): Closes the serial port connection.
 * 
 * Dependencies:
 * - serialport: For serial communication.
 * - events: For event handling.
 * - async-mutex: For mutex locking.
 * - Custom modules:
 *   - MIDIParser
 *   - FaderMovementCalculator
 *   - Fader
 *   - FaderMove
 *   - MIDIQueue
 *   - MIDIFeedbackTracker
 *   - MIDIHandler
 *   - CalibrationEngine
 *   - FaderEventEmitter
 *   - errors
 */

const { SerialPort } = require('serialport');
const EventEmitter = require('events');
const Mutex = require('async-mutex').Mutex;

const MIDIParser = require('../midi/MIDIParser');
const MovementCalculator = require('./FaderMovementCalculator');
const Fader = require('./Fader'); // Import the outsourced Fader class
const FaderMove = require('./FaderMove');

const MIDIQueue = require('../midi/MIDIQueue');
const MIDIFeedbackTracker = require('../midi/MIDIFeedbackTracker')
const MIDIHandler = require('../midi/MIDIHandler')

const CalibrationEngine = require('../calibration/CalibrationEngine'); // Import the CalibrationEngine

const FaderEventEmitter = require('../events/FaderEventEmitter'); // Import the CalibrationEngine


const {
  FaderControllerError,
  SerialPortError,
  MIDIError,
  CalibrationError,
  MIDIQueueError,
  MIDIFeedbackTrackerError,
  FaderErrors,
  SerialErrors
} = require('../errors');


/**
 * Emitted Events:
 * - 'touch'(index, faderInfo) - Fader touched
 * - 'untouch'(index, faderInfo) - Fader released  
 * - 'move'(index, faderInfo) - Fader position changed
 * - 'error'(Error) - Critical failure
 * - 'midi'(rawData) - Raw MIDI input
 * - 'ready' - Fader controller is ready
 * - 'configChange'(index, config) - Fader configuration changed
 * - 'calibration'(index, calibrationData) - Fader calibration data
 */
class FaderController extends FaderEventEmitter {
  constructor(config = {}) {
    super(config.logger, config);

    // Default calibration configuration
    const defaultCalibrationConfig = {
      startProgression: 0,
      endProgression: 100,
      calibrationCount: 20,
      startSpeed: 10,
      endSpeed: 100,
      resolutions: [1, 0.8, 0.5, 0.2], // Default resolutions
      warmupRuns: 1, // Default warmup runs
      measureRuns: 2 // Default measure runs
    };

    // Merge provided calibration config with defaults
    this.calibrationConfig = {
      ...defaultCalibrationConfig,
      ...(config.calibrationConfig || {})
    };

    this.config = {
      logger: console,
      MIDILog: false,
      ValueLog: false,
      MoveLog: false,
      messageDelay: 0.0001,
      speeds: [60, 30, 10],
      faderIndexes: [0, 1],
      queueOverflow: 16383,
      calibrateOnStart: true,
      feedback_midi: true, // enable if midi device supports feedback
      feedback_tolerance: 10, // tolerance for feedback
      disableInternalEventLogging: false, // Disable internal event logging
      disableEventLogging: false, // Disable all event logging
      ...config
    };

    this.faders = this.createFaders();
    this.listenFaders(this.faders)

    this.midiHandler = null;
    this.midiQueue = null;
    
    this.queueMutex = new Mutex();
    this.reconnectAttempts = 5;
    this.serial = null;
    this.isShuttingDown = false; // Track intentional shutdown vs unexpected disconnect
    this.initMIDIState();

    this.speedMultiplier = 1; //! Adjust this value to control speed
  }

  //* INIT CONF AND INSTANCES #############################################

  logConfig() {
    //loop through config and log the values
    if (this.config.logger) {
      this.config.logger.seperator('debug');
      for (const [key, value] of Object.entries(this.config)) {
        if (key !== 'logger') {
          this.config.logger.debug(`${key}: ${value}`);
        }
      }
      // also log fader infos for each fader
      this.faders.forEach(fader => {
        this.config.logger.debug(`Fader ${fader.index}: ${JSON.stringify(fader.info)}`);
      });
      this.config.logger.seperator('debug');
    }
  }

//* FADER SETUP #############################################

  setFaderTrim(index, min, max) {
  this.getFader(index).setProgressionMap([min, max]);
  }

  createFaders() {
    return this.config.faderIndexes.map(index => {
      return new Fader(index, this.config);
    });
  }

  setFaderProgressionMap(index, range) { // make this accept multiple indexes optionally
    const fader = this.getFader(index);
    if (!fader) throw new Error(`Fader ${index} not found`);
    fader.setProgressionMap(range);
  }

  setFadersMovementSpeedFactor(index, speedFactor) {
    const fader = this.getFader(index);
    if (!fader) throw new Error(`Fader ${index} not found`);
    if (typeof speedFactor !== 'number' || speedFactor <= 0 || speedFactor === null) {
        this.config.logger.warn(`Invalid speedFactor for fader ${index}. Resetting to default (1).`);
        speedFactor = 1; // Reset to default if invalid
    }
    fader.speedFactor = speedFactor;
  }

  setFaderEchoMode(index, echoMode) {
    const fader = this.getFader(index);
    if (!fader) throw new Error(`Fader ${index} not found`);
    fader.setEchoMode(echoMode);
  }

  listenFaders(faders) { // pass events of faders
    faders.forEach(fader => {
      fader.on('internal:touch', (index, info) => this.emit('touch', index, info));
      fader.on('internal:untouch', (index, info) => this.emit('untouch', index, info));
      fader.on('internal:echo/on', (index, echoMode) => this.emit('echo/on', index, echoMode));
      fader.on('internal:echo/off', (index, echoMode) => this.emit('echo/off', index, echoMode));
      fader.on('internal:move', (index, info) => this.emit('move', index, info)); // user move
      fader.on('internal:move/start', (index, info) => this.emit('move/start', index, info)); // External event
      fader.on('internal:move/complete', (index, info) => this.emit('move/complete', index, info)); // External event
      fader.on('internal:move/step/start', (index, info) => this.emit('move/step/start', index, info)); // External event
      fader.on('internal:move/step/complete', (index, info) => this.emit('move/step/complete', index, info)); // External event
      fader.on('internal:configChange', (index, config) => this.emit('configChange', index, config));
    });
  }

  listenMIDI(midiHandler) {
    midiHandler.on('midi', rawData => this.emit('midi', rawData));
    midiHandler.on('error', error => this.emit('error', error));
  }

  listenMIDIQueue(MIDIQueue) {
    return
  }

  listenMIDIFeedback(MIDIFeedbackTracker) {
    return
  }

  //* MIDI Handling #############################################
  initMIDIState() {
    this.midiDeviceReady = false;
    this.midiCache = [];
  }

  handleDisconnect() {
    // Don't treat intentional shutdown as error
    if (this.isShuttingDown) {
      this.config.logger.debug('Serial port closed during shutdown (expected)');
      return;
    }

    const disconnectError = new SerialPortError(
        SerialErrors.SERIAL_PORT_DISCONNECTED,
        'Serial port disconnected',
        { reconnectAttempts: this.reconnectAttempts }
    );

    this.emit('error', disconnectError);

    const reconnect = () => {
        if (this.reconnectAttempts++ < 5) {
            this.setupSerial(this.lastSerialConfig).catch(() => 
                setTimeout(reconnect, 2000)
            );
        }
    };

    reconnect();
}

  handleMIDIMessage(message) {
    try {
        if (this.config.MIDILog) {
            this.config.logger.debug(`MIDI HANDLE: ${message.type}`);
        }

        switch(message.type) {
            case 'PITCH_BEND':
                this.handleFaderMove(message);
                break;
            case 'NOTE_ON':
            case 'NOTE_OFF':
                this.handleTouch(message);
                break;
            case 'PROGRAM_CHANGE':
                this.midiCache.push(message);
                // this.cacheMIDIStatus(message.raw);
                break;
            case 'SYSEX':
                this.handleSysExFeedback(message);
                break;
        }
    } catch (error) {
        this.emit('error', error);
    }
  }

  handleSysExFeedback(message) {
    const position = (message.data2 << 7) | message.data1;
    const fader = this.getFader(message.channel);

    if (fader && this.midiQueue.feedbackTracker.isTrackingFeedback(message.channel)) {
        this.midiQueue.feedbackTracker.handleFeedbackMessage(message.channel, position);
        fader.updatePositionFeedback(position);
    }
  }

  handleFaderMove(message) {
    const position = (message.data2 << 7) | message.data1;
    const fader = this.getFader(message.channel);
  
    if (fader) {
      // Check if this is feedback for a software-driven movement
      if (!fader.touch && this.midiQueue.feedbackTracker.isTrackingFeedback(message.channel)) {
        
        this.midiQueue.feedbackTracker.handleFeedbackMessage(message.channel, position);
        fader.updatePositionFeedback(position);

      } else {
        // Handle user-driven movement
        fader.updatePositionUser(position);
        if (fader.echoMode) {
          const mappedPos = fader.mapPosition(position);
          const options = {
            disableFeedback: true
          };
          this.midiQueue.add([
            message.channel,
            mappedPos & 0x7F,
            (mappedPos >> 7) & 0x7F
          ], options);
        }
      }
    }
  }

  handleTouch(message) {
    const fader = this.getFader(message.channel);
    if (fader && message.type == "NOTE_ON") {
      fader.updateTouchState(true);
    } else if (fader && message.type == "NOTE_OFF") {
      fader.updateTouchState(false);
    }
  }

  cacheMIDIStatus(data) {
    if (data[0] === 0xC0) {
      this.midiCache.push(data);
      if (this.midiCache.length > 10) this.midiCache.shift();
    }
  }

  //* Movement Control #############################################
  async moveFaders(move, interrupt = false, disableFeedback = false, moveId = undefined) {
    try {
      if (interrupt) this.clearQueue(move.indexes);
  
      // Enable feedback simulation if feedback is disabled
      if (!this.config.feedback_midi || disableFeedback) {
        this.midiQueue.feedbackTracker.enableSoftwareFeedback();
      } else {
        this.midiQueue.feedbackTracker.disableSoftwareFeedback();
      }
  
      const movements = move.indexes.map((index, i) => {
        const fader = this.getFader(index);
        const effectiveSpeed = this.calculateEffectiveSpeed(
          move.speeds[i],
          fader.speedFactor,
          fader.progression,
          move.targets[i]
        );
  
        return {
          index,
          target: fader.mapProgression(move.targets[i]),
          speed: effectiveSpeed,
          resolution: move.resolution
        };
      });
  
      const positions = this.calculateMovements(movements);
      const options = { disableFeedback, moveId };
  
      await this.sendPositions(positions, options);
      this._LogMove(positions, options, movements, interrupt);
  
    } catch (error) {
      this.config.logger.error(`Error in moveFaders: ${error.message}`, {
        move,
        error
      });
      this.emit('error', Object.assign(error, {
        code: FaderErrors.MOVEMENT_ERROR,
        move
      }));
      throw error;
    }
  }

  _LogMove(positions, options, movements, interrupt) {
    if (this.config.MoveLog) {
      this.config.logger.debug('========== MOVE LOG ==========');
      this.config.logger.debug(`Move ID: ${options.moveId || 'N/A'}`);
      // Log general movement details
      this.config.logger.debug(`Interrupt: ${interrupt}`);
      this.config.logger.debug(`Feedback Disabled: ${options.disableFeedback}`);
      this.config.logger.debug(`Number of Positions: ${positions.length}`);
  
      // Log detailed movement information for each fader
      movements.forEach((movement, i) => {
        const position = positions.find(pos => pos.index === movement.index);
        this.config.logger.debug(`Fader ${movement.index}:`);
        this.config.logger.debug(`  Target Position: ${movement.target}`);
        this.config.logger.debug(`  Effective Speed: ${movement.speed}`);
        this.config.logger.debug(`  Resolution: ${movement.resolution}`);
        if (position) {
          this.config.logger.debug(`  Final Position Sent: ${position.value}`);
        }
      });
  
      this.config.logger.debug('==============================');
    }
  
    if (this.config.ValueLog) {
      this.config.logger.debug('========== MOVE VALUE LOG ==========');
      positions.forEach(pos => {
        this.config.logger.debug(`Fader ${pos.index}: Position Sent: ${pos.value}`);
      });
      this.config.logger.debug('====================================');
    }
  }

  calculateEffectiveSpeed(requestedSpeed, speedFactor, currentPos, targetPos) {
    // Apply speed factor
    return Math.max(0.1, requestedSpeed * speedFactor);
  }

  calculateMovements(movements) {
    const positions = [];
  
    movements.forEach(move => {
      // Validate input
      if (typeof move.speed !== 'number' || move.speed <= 0 || move.speed > 100) {
        throw new Error(`Invalid speed ${move.speed} for fader ${move.index} - must be >0 and <=100`);
      }
  
      const fader = this.getFader(move.index);
      const faderPositions = MovementCalculator.calculateMovements(
        fader,
        move.target,
        move.speed,
        move.resolution,
        this.speedMultiplier
      );
  
      positions.push(...faderPositions);
    });
  
    return positions;
  }

  /**
   * Sends an array of fader positions to the MIDI queue for processing.
   *
   * @async
   * @param {Array<{index: number, value: number}>} positions - An array of position objects.
   * Each object should have the following properties:
   *   - `index` {number}: The index of the fader (0-15).
   *   - `value` {number}: The position value of the fader (0-16383).
   * 
   * @throws {Error} Throws an error if the queue lock cannot be acquired or if a queue overflow occurs.
   * The error object will include additional properties:
   *   - `code` {string}: Error code ('QUEUE_LOCK_ERROR' or 'QUEUE_OVERFLOW').
   *   - `positions` {Array} (for 'QUEUE_LOCK_ERROR'): The positions array that caused the error.
   *   - `count` {number} (for 'QUEUE_OVERFLOW'): The number of messages in the queue.
   * 
   * @emits error - Emits an 'error' event with the error object and additional details.
   */
  async sendPositions(positions, options = {}) {
    const release = await this.queueMutex.acquire().catch(error => {
      this.emit('error', Object.assign(error, {
        code: 'QUEUE_LOCK_ERROR',
        positions
      }));
      throw error;
    });
  
    try {
      if (positions.length > this.config.queueOverflow) {
        this.emit('error', new Error('Queue overflow'), {
          code: FaderErrors.QUEUE_OVERFLOW,
          count: positions.length
        });
        positions.splice(this.config.queueOverflow);
      }
  
      await Promise.all(positions.map(pos => {
        const message = [
          0xE0 | pos.index,
          pos.value & 0x7F,
          (pos.value >> 7) & 0x7F
        ];
        return this.midiQueue.add(message, options); // Pass options here
      }));
    } catch (error) {
      this.emit('error', Object.assign(error, {
        code: FaderErrors.SEND_POS_ERROR,
        positions
      }));
      throw error;
    } finally {
      release();
    }
  }

  //* Calibration System #############################################
  //! deprecated and outsourced
  async advancedCalibration(indexes) {
    this.calibrationEngine = new CalibrationEngine(this);
    return this.calibrationEngine.runCalibration(indexes); // Delegate to CalibrationEngine
  }

  async runCalibrationMove(index, StartProgression, EndProgression, speed, resolution) {
    try {
      const fader = this.getFader(index);
      // FaderMove(indexes, targets, speeds, resolution)
      // EndProgression is the target progression (0-100), speed is the movement speed
      const faderMove = new FaderMove([index], [EndProgression], [speed], resolution);
      
      // Calculate how many MIDI messages will be sent
      const effectiveSpeed = this.calculateEffectiveSpeed(
        speed,
        fader.speedFactor,
        fader.progression,
        EndProgression
      );
      
      const movements = [{
        index,
        target: fader.mapProgression(EndProgression),
        speed: effectiveSpeed,
        resolution
      }];
      
      const positions = this.calculateMovements(movements);
      const messageCount = positions.length;
      
      // Calculate MIDI queue processing time: each message has message delay between them
      const messageDelayMs = this.config.messageDelay || 10; // already in milliseconds from config
      const queueProcessingTime = messageCount * messageDelayMs;
      
      this.config.logger.debug(`[CALIB_MOVE] Fader ${index}: ${StartProgression}→${EndProgression} @speed ${speed}, ${messageCount} messages, ${queueProcessingTime.toFixed(0)}ms queue time`);
      
      const startTime = Date.now();
      
      // Send all MIDI messages with real hardware feedback (disableFeedback = false for actual movement)
      await this.moveFaders(faderMove, false, false);
      
      // Wait for all MIDI messages to process through the queue
      await new Promise(resolve => setTimeout(resolve, Math.ceil(queueProcessingTime)));
      
      const duration = Date.now() - startTime;
      
      this.config.logger.debug(`[CALIB_MOVE] Duration: ${duration}ms (messages: ${messageCount}, delay per msg: ${messageDelayMs.toFixed(1)}ms)`);
      
      return duration;
    } catch (err) {
      this.config.logger.error(`[CALIB_MOVE] Error in runCalibrationMove: ${err.message}`);
      throw err;
    }
  }

  //* basic calibration #############################################
  async calibrate(indexes = this.config.faderIndexes) {
    this.config.logger.debug(`Calibrating...`);
    return await this.testCalibrationMoves(indexes);
  }

  async testCalibrationMoves(indexes, speed_up = 50, speed_down = 10, resolution = 1) {
    try {
      let moves = [
        new FaderMove(indexes, 100, speed_up, resolution),
        new FaderMove(indexes, 0, speed_down, resolution)
      ];
      await this.reset(indexes);
      for (let i = 0; i < moves.length; i++) {
        await this.moveFaders(moves[i], false, false);
      }
    } catch (error) {
      this.config.logger.error(`Error during testCalibrationMoves: ${error.message}`, {
        indexes,
        speed_up,
        speed_down,
        resolution,
        error
      });
      this.emit('error', Object.assign(error, {
        code: FaderErrors.CALIBRATION_FAILED,
        details: { indexes, speed_up, speed_down, resolution }
      }));
      throw error;
    }
  }

  //* Public API #############################################

  async setupSerial(serialConfig) {
    const port = serialConfig.port;
    const baudRate = serialConfig.baudRate;
    const retries = serialConfig.retries || 5;
    for (let i = 1; i <= retries; i++) {
      try {
        this.serial = new SerialPort({ path: port, baudRate });
        this.midiHandler = new MIDIHandler(this);
        this.listenMIDI(this.midiHandler)

        this.midiQueue = new MIDIQueue(this.serial, this, this.config.messageDelay);
        this.listenMIDIQueue(this.midiQueue)

        this.serial.on('close', () => this.handleDisconnect());
        this.serial.pipe(this.midiHandler.parser);
        
        await new Promise((resolve, reject) => {
          this.serial.once('open', resolve);
          this.serial.once('error', reject);
        });
        
        return;
      } catch (err) {
        const attemptError = Object.assign(err, {
          code: SerialErrors.SERIAL_PORT_CONNECTION_FAILED,
          attempt: i,
          maxAttempts: retries
        });
        
        this.emit('error', attemptError);
        
        if (i === retries) {
          throw attemptError;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async start() {
    if (!this.serial?.isOpen) {
      throw new Error('Serial port not initialized');
    }

    try {
      await this.checkMIDIDeviceReady();
      if (this.config.calibrateOnStart) await this.calibrate(this.config.faderIndexes);
      this.emit('internal:ready');
      this.config.logger.info(`FaderController started successfully`);
    } catch (error) {
      this.config.logger.error('Startup failed:', error);
      throw error;
    }
  }

  async stop() {
    try {
      this.isShuttingDown = true; // Set flag before closing
      await this.closeSerial();
      this.config.logger.info('FaderController stopped successfully');
    } catch (error) {
      this.config.logger.error('Error while stopping FaderController:', error);
      this.emit('error', { message: 'Failed to stop FaderController', details: error.message });
    } finally {
      this.isShuttingDown = false; // Reset flag
    }
  }

  reset(indexes = this.config.faderIndexes) {
    return this.moveFaders(new FaderMove(indexes, 0, this.config.speeds[1], 1), true, true, 'reset');
  }

  combineMoves(moves) {
    return FaderMove.combineMoves(moves)
  }

  //* Utilities #############################################
  getFader(index) {
    try {
      const fader = this.faders[index];
      if (!fader) throw new Error(`Fader ${index} not found`);
      return fader;
    } catch (error) {
      this.emit('error', Object.assign(error, {
        code: 'FADER_NOT_FOUND',
        requestedIndex: index,
        availableIndexes: this.config.faderIndexes
      }));
      throw error;
    }
  }

  clearQueue(indexes) {
    try {
      if (!Array.isArray(indexes)) {
        indexes = [indexes];
      }
      
      for (const index of indexes) {
        this.midiQueue.flush(index);
      }
    } catch (error) {
      this.config.logger.error(`Error clearing queue for indexes: ${indexes}`, error);
      this.emit('error', Object.assign(error, {
        code: FaderErrors.QUEUE_CLEAR_ERROR,
        indexes
      }));
    }
  }

  async closeSerial() {
    try {
      if (this.serial?.isOpen) {
        await new Promise((resolve, reject) => {
          this.serial.close(err => {
            if (err) {
              const error = new SerialPortError('Error closing serial port', err);
              this.config.logger.error(error.message, { originalError: err });
              return reject(error);
            }
            this.config.logger.info('Serial port closed successfully');
            resolve();
          });
        });
      } else {
        this.config.logger.info('Serial port was not open');
      }
    } catch (error) {
      const serialError = new SerialPortError('Error in closeSerial', error);
      this.config.logger.error(serialError.message, { originalError: error });
      this.emit('error', serialError); // Emit the error for higher-level handling
      throw serialError; // Re-throw the error for propagation
    }
  }

  async checkMIDIDeviceReady(maxAttempts = 10) {
    try {
        let attempts = 0;
        const READY_SIGNAL_1 = 160;
        const READY_SIGNAL_2 = 50;

        while (attempts < maxAttempts && !this.midiDeviceReady) {
            // Check for specific ready signals in PROGRAM_CHANGE messages
            if (this.midiCache.length === 0) {
                this.config.logger.debug(`No MIDI messages received yet, waiting...`);
            }

            const isReady = this.midiCache.some(msg => {
                // Ensure the message has the expected structure
                // already parsed not / raw message object
                if (msg.type === 'PROGRAM_CHANGE' && msg.data1 === READY_SIGNAL_1 || msg.data2 === READY_SIGNAL_2) {
                    this.config.logger.debug(`MIDI device ready signal received: ${msg.raw}`);
                    return true;
                }
                return false;
            });

            if (isReady) {
                this.midiDeviceReady = true;
                this.config.logger.debug(`MIDI device ready signal received`);
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 1500)); // Increased timeout
            attempts++;
            this.config.logger.debug(`Device check attempt ${attempts}/${maxAttempts}`);
       }

        throw new Error(`MIDI device not responding after ${maxAttempts} attempts`);
    } catch (error) {
        this.emit('error', {
            ...error,
            code: FaderErrors.DEVICE_NOT_READY,
            attempts: maxAttempts,
            lastMessages: this.midiCache.slice(-5) // Include recent messages for debugging
        });
        throw error;
    }
}
}

module.exports = FaderController;