import { Component, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, LocationInfo } from './services/gemini.service';

@Component({
  selector: 'app-root',
  standalone: true, // v18+ default, but explicit for clarity in strict envs
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  changeDetection: 1 // OnPush
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  // State
  sourceQuery = signal('');
  targetQuery = signal('');
  
  sourceLocation = signal<LocationInfo | null>(null);
  targetLocation = signal<LocationInfo | null>(null);
  
  isLoadingSource = signal(false);
  isLoadingTarget = signal(false);
  
  // Date Handling
  // We initialize this, but it will be overwritten once the source location is resolved to match that location's time.
  selectedDate = signal<string>(new Date().toISOString().slice(0, 16)); 
  
  error = signal<string | null>(null);

  // Quick Select Options
  popularLocations = ['London', 'New York', 'Tokyo', 'Sydney', 'Dubai', 'Paris', 'Los Angeles', 'India'];

  constructor() {
    // Initial Defaults - Use Countries/Major Cities
    this.resolveSource('London');
    this.resolveTarget('New York');
  }

  async resolveSource(query: string = this.sourceQuery()) {
    if (!query) return;
    this.isLoadingSource.set(true);
    this.error.set(null);
    // If called via chip click, update the input model too
    this.sourceQuery.set(query); 
    
    try {
      const result = await this.geminiService.resolveLocation(query);
      if (result) {
        this.sourceLocation.set(result);
        this.sourceQuery.set(result.fullName);
        // Update the date picker to show the CURRENT time in the resolved source location
        this.updateTimeForSource(result.ianaTimezone);
      } else {
        this.error.set(`Could not find location: ${query}`);
      }
    } catch (e) {
      this.error.set('Failed to resolve source location.');
    } finally {
      this.isLoadingSource.set(false);
    }
  }

  async resolveTarget(query: string = this.targetQuery()) {
    if (!query) return;
    this.isLoadingTarget.set(true);
    this.error.set(null);
    // If called via chip click, update the input model too
    this.targetQuery.set(query);

    try {
      const result = await this.geminiService.resolveLocation(query);
      if (result) {
        this.targetLocation.set(result);
        this.targetQuery.set(result.fullName);
      } else {
        this.error.set(`Could not find location: ${query}`);
      }
    } catch (e) {
      this.error.set('Failed to resolve target location.');
    } finally {
      this.isLoadingTarget.set(false);
    }
  }

  swapLocations() {
    const sLoc = this.sourceLocation();
    const tLoc = this.targetLocation();
    const sQ = this.sourceQuery();
    const tQ = this.targetQuery();

    this.sourceLocation.set(tLoc);
    this.targetLocation.set(sLoc);
    this.sourceQuery.set(tQ);
    this.targetQuery.set(sQ);

    // When swapping, update the time input to reflect the current time in the NEW source location
    if (tLoc) {
      this.updateTimeForSource(tLoc.ianaTimezone);
    }
  }

  private updateTimeForSource(timeZone: string) {
    try {
      const now = new Date();
      // Format the current absolute time into the Source's Wall Clock components
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(now);

      const getPart = (type: string) => parts.find(p => p.type === type)?.value;
      
      // Construct YYYY-MM-DDTHH:mm string
      const isoLocal = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
      this.selectedDate.set(isoLocal);
    } catch (e) {
      console.warn('Could not update source time automatically', e);
    }
  }

  // Computed results
  convertedResult = computed(() => {
    const src = this.sourceLocation();
    const tgt = this.targetLocation();
    const dateStr = this.selectedDate();

    if (!src || !tgt || !dateStr) return null;

    try {
      // Create a date object from the input string, interpreting it as being in the SOURCE timezone
      const [datePart, timePart] = dateStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);

      // Strategy:
      // 1. Get current time.
      const now = new Date();
      // 2. Get formatted time string for Source and Target
      const srcStr = now.toLocaleString('en-US', { timeZone: src.ianaTimezone, hour12: false });
      const tgtStr = now.toLocaleString('en-US', { timeZone: tgt.ianaTimezone, hour12: false });
      
      // 3. Calculate offset difference in hours roughly based on current time
      const srcDate = new Date(srcStr);
      const tgtDate = new Date(tgtStr);
      const diffMs = tgtDate.getTime() - srcDate.getTime();
      
      // 4. Apply this difference to the User's Selected Date
      // The user's input `selectedDate()` is treated as "Wall clock time in Source".
      // So we parse it as a plain date, add the diff, and that is "Wall clock time in Target".
      const inputWallTime = new Date(dateStr); // Parsed as local, but we only care about the numbers
      const targetWallTime = new Date(inputWallTime.getTime() + diffMs);
      
      return {
        sourceTimeDisplay: this.formatDate(inputWallTime),
        targetTimeDisplay: this.formatDate(targetWallTime),
        diffHours: (diffMs / (1000 * 60 * 60)).toFixed(1),
        isNextDay: targetWallTime.getDate() !== inputWallTime.getDate()
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }
}