class MIDIFeedbackTracker {
  constructor(controller) {
    this.controller = controller;
    this.feedbackTracking = new Map();
    this.feedbackStatistics = new Map();
    this.softwareFeedback = false; // Software feedback only, move is considered complete as soon as sent
  }

  isTrackingFeedback(faderIndex) {
    return this.feedbackTracking.has(faderIndex);
  }

  clearFeedback(faderIndex) {
    if (this.feedbackTracking.has(faderIndex)) {
      this.controller.config.logger.debug(`Clearing feedback for fader ${faderIndex}`);
      this.feedbackTracking.delete(faderIndex);
    }
  }

  clearAllFeedback() {
    this.feedbackTracking.clear();
  }

  getTargetPosition(faderIndex) {
    return this.feedbackTracking.get(faderIndex);
  }
  
  enableSoftwareFeedback() {
    this.softwareFeedback = true;
  }

  disableSoftwareFeedback() {
    this.softwareFeedback = false;
  }

  trackFeedbackStart(faderIndex, targetPosition) {
    this.controller.config.logger.debug(`trackFeedbackStart called for fader ${faderIndex}`);
    this.controller.config.logger.debug(`Current feedbackTracking state: ${JSON.stringify([...this.feedbackTracking])}`);
  
    if (!this.feedbackStatistics.has(faderIndex)) {
      this.feedbackStatistics.set(faderIndex, []);
    }
  
    this.feedbackStatistics.get(faderIndex).push({
      targetPosition,
      startTime: Date.now(),
      completed: false,
      started: false
    });
  
    this.feedbackTracking.set(faderIndex, { targetPosition });
    this.controller.config.logger.debug(`Updated feedbackTracking state: ${JSON.stringify([...this.feedbackTracking])}`);
  }

  handleFeedbackMessage(faderIndex, currentPosition, tolerance = 0) {
      if (this.controller.config.MIDILog) {
          this.controller.config.logger.debug(`Current feedbackTracking state: ${JSON.stringify([...this.feedbackTracking])}`);
      }
      
  
      if (this.feedbackTracking.has(faderIndex)) {
          const { targetPosition } = this.feedbackTracking.get(faderIndex);
          const stats = this.feedbackStatistics.get(faderIndex).find(stat => stat.targetPosition === targetPosition && !stat.completed);
  
          tolerance = tolerance || this.controller.config.feedback_tolerance;
  
          const positionDifference = Math.abs(currentPosition - targetPosition);
          if (this.controller.config.MIDILog) {
              this.controller.config.logger.debug(`Fader ${faderIndex}: Target Position: ${targetPosition}, Current Position: ${currentPosition}, Difference: ${positionDifference}, Tolerance: ${tolerance}`);
          }
  
          if (positionDifference <= tolerance) {
              if (this.controller.config.MIDILog) {
                  this.controller.config.logger.debug(`Fader ${faderIndex}: Position within tolerance. Marking movement as complete.`);
              }
              this.markMovementComplete(faderIndex);
          } else {
              if (this.controller.config.MIDILog) {
                  this.controller.config.logger.debug(`Fader ${faderIndex}: Position outside tolerance. Movement not complete.`);
              }
          }
      } else {
          if (this.controller.config.MIDILog) {
              this.controller.config.logger.debug(`Fader ${faderIndex}: No feedback tracking found.`);
          }
      }
  }

  markMovementComplete(faderIndex) {
    try {
      if (this.softwareFeedback) {
        // Software feedback mode: still need to record timing data for calibration
        if (this.feedbackTracking.has(faderIndex)) {
          const { targetPosition } = this.feedbackTracking.get(faderIndex);
          this.feedbackTracking.delete(faderIndex);
  
          const stats = this.feedbackStatistics.get(faderIndex)?.find(
            stat => stat.targetPosition === targetPosition && !stat.completed
          );
          if (stats) {
            stats.completed = true;
            stats.endTime = Date.now();
            stats.duration = stats.endTime - stats.startTime;
          }
        }
        
        const fader = this.controller.getFader(faderIndex);
        fader.updatePositionFeedback(fader.position);
        fader.emitMoveStepComplete(this.getFeedbackStatistics(faderIndex));
        fader.emitMoveComplete(this.getFeedbackStatistics(faderIndex));
  
        // Log statistics if MoveLog is enabled
        if (this.controller.config.MoveLog) {
          this.logMoveStatistics(faderIndex);
        }
        return;
      }
  
      if (this.feedbackTracking.has(faderIndex)) {
        const { targetPosition } = this.feedbackTracking.get(faderIndex);
        this.feedbackTracking.delete(faderIndex);
  
        const stats = this.feedbackStatistics.get(faderIndex).find(stat => stat.targetPosition === targetPosition && !stat.completed);
        if (stats) {
          stats.completed = true;
          stats.endTime = Date.now();
          stats.duration = stats.endTime - stats.startTime;
        }
  
        const fader = this.controller.getFader(faderIndex);
        fader.emitMoveStepComplete(this.getFeedbackStatistics(faderIndex));
        fader.emitMoveComplete(this.getFeedbackStatistics(faderIndex));
  
        // Log statistics if MoveLog is enabled
        if (this.controller.config.MoveLog) {
          this.logMoveStatistics(faderIndex);
        }
      }
    } catch (error) {
      this.controller.config.logger.error(`Error in markMovementComplete for fader ${faderIndex}: ${error.message}`, {
        stack: error.stack,
        faderIndex,
        feedbackTracking: JSON.stringify([...this.feedbackTracking]),
        feedbackStatistics: JSON.stringify(this.feedbackStatistics.get(faderIndex) || [])
      });
    }
  }
  handleMoveStart(faderIndex, targetPosition) {
    const fader = this.controller.getFader(faderIndex);
    fader.emitMoveStart(targetPosition, Date.now());
  }

  handleMoveStep(faderIndex, position, isLastStep = false) {
    const fader = this.controller.getFader(faderIndex);

    // Emit 'move/step/start'
    fader.emitMoveStepStart(position, Date.now());

    // Emit 'move/step/complete'
    fader.emitMoveStepComplete(this.getFeedbackStatistics(faderIndex));

    // Emit 'move/complete' if this is the last step
    if (isLastStep) {
      fader.emitMoveComplete(this.getFeedbackStatistics(faderIndex));
    }
  }

  getFeedbackStatistics(faderIndex) {
    return this.feedbackStatistics.get(faderIndex) || [];
  }

  logMoveStatistics(faderIndex) {
    const stats = this.getFeedbackStatistics(faderIndex);
    if (stats && stats.length > 0) {
      const lastStat = stats[stats.length - 1]; // Get the most recent statistics

      const startTime = lastStat.startTime ? new Date(lastStat.startTime).toISOString() : 'Invalid start time';
      const endTime = lastStat.endTime ? new Date(lastStat.endTime).toISOString() : 'Invalid end time';
      const duration = lastStat.duration || 'Unknown duration';

      this.controller.config.logger.debug('========== MOVE STATISTICS ==========');
      this.controller.config.logger.debug(`Fader Index: ${faderIndex}`);
      this.controller.config.logger.debug(`Target Position: ${lastStat.targetPosition}`);
      this.controller.config.logger.debug(`Start Time: ${startTime}`);
      this.controller.config.logger.debug(`End Time: ${endTime}`);
      this.controller.config.logger.debug(`Duration: ${duration} ms`);
      this.controller.config.logger.debug(`Tracking Type: ${this.softwareFeedback ? 'Software' : 'Hardware'}`);
      this.controller.config.logger.debug('=====================================');
    } else {
      this.controller.config.logger.debug(`No statistics available for fader ${faderIndex}`);
    }
  }

}

module.exports = MIDIFeedbackTracker;