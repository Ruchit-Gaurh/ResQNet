import { apiService } from './api';

export interface DemoStep {
  stepNumber: number;
  title: string;
  description: string;
  actor: 'PHONE_A_FAMILY' | 'BLE_HOP' | 'GATEWAY_SYNC' | 'HOSPITAL' | 'AI_ENGINE' | 'ADMIN_VERIFY' | 'FAMILY_LOCATED';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  logMessage: string;
  timestamp?: string;
  details?: Record<string, any>;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    stepNumber: 1,
    title: 'Phone A (Family) Creates Offline Report',
    description: 'Family reports missing brother Rahul Sharma (Age 22, Blue T-shirt, Zone A). Wi-Fi/Cellular is OFF.',
    actor: 'PHONE_A_FAMILY',
    status: 'PENDING',
    logMessage: 'Report created on device [PSEUDO-88F]. State: "Saved locally — waiting for connectivity".'
  },
  {
    stepNumber: 2,
    title: 'Peer Discovery & BLE Mesh Relay',
    description: 'Phone B (Courier node) moves into BLE range of Phone A. Store-and-forward peer exchange occurs.',
    actor: 'BLE_HOP',
    status: 'PENDING',
    logMessage: 'GATT handshake verified. Envelope [msg-9901-uuid] hopped: Phone A -> Phone B (Hop Count: 1/7). Priority: HIGH.'
  },
  {
    stepNumber: 3,
    title: 'Gateway Reached & Cloud Batch Sync',
    description: 'Phone B encounters Starlink Command Gateway. Automatic batch flush executed.',
    actor: 'GATEWAY_SYNC',
    status: 'PENDING',
    logMessage: 'Gateway acknowledged envelope [msg-9901-uuid]. Ingested into PostgreSQL case database as CASE-10291.'
  },
  {
    stepNumber: 4,
    title: 'Hospital Registers Unidentified Patient',
    description: 'Zone B Trauma Center inputs intake form: Rahool Sharma (Age 23, Blue shirt, mild concussion).',
    actor: 'HOSPITAL',
    status: 'PENDING',
    logMessage: 'New intake created as CASE-10305 (Source: Zone B Hospital Trauma Center).'
  },
  {
    stepNumber: 5,
    title: 'AI Matching Microservice Evaluates Candidate',
    description: 'FastAPI service runs RapidFuzz phonetic token matching and geo-distance calculations.',
    actor: 'AI_ENGINE',
    status: 'PENDING',
    logMessage: 'POTENTIAL MATCH GENERATED: 91.2% (Phonetic Name: 94%, Age: 95%, Location: 88%, Clothing: 85%). Added to Verification Queue.'
  },
  {
    stepNumber: 6,
    title: 'Admin Verifies Identity & Family Notified',
    description: 'Ruchit (Admin) inspects explainable evidence breakdown and confirms identity.',
    actor: 'ADMIN_VERIFY',
    status: 'PENDING',
    logMessage: 'Identity VERIFIED. Audit trail #AUDIT-102 logged. Encrypted family notification pushed: "🟢 PERSON LOCATED".'
  }
];

class DemoSimulator {
  private currentStepIndex: number = 0;
  private isAutoPlaying: boolean = false;
  private autoPlayTimer: any = null;
  private listeners: Set<() => void> = new Set();
  public steps: DemoStep[] = JSON.parse(JSON.stringify(DEMO_STEPS));

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getCurrentStep(): number {
    return this.currentStepIndex;
  }

  public reset() {
    if (this.autoPlayTimer) clearTimeout(this.autoPlayTimer);
    this.isAutoPlaying = false;
    this.currentStepIndex = 0;
    this.steps = JSON.parse(JSON.stringify(DEMO_STEPS));
    apiService.resetMockData();
    this.notify();
  }

  public async advanceStep(): Promise<void> {
    if (this.currentStepIndex >= this.steps.length) return;

    // Mark previous as completed
    for (let i = 0; i < this.currentStepIndex; i++) {
      this.steps[i].status = 'COMPLETED';
    }

    const step = this.steps[this.currentStepIndex];
    step.status = 'ACTIVE';
    step.timestamp = new Date().toLocaleTimeString();

    // Trigger state changes in API Service corresponding to step
    if (step.stepNumber === 5) {
      // Refresh pending matches
    } else if (step.stepNumber === 6) {
      await apiService.verifyMatch(
        'MATCH-4821',
        'Ruchit Gaurh (Lead)',
        'Confirmed with Hospital Ward 2 intake nurse and family identification marks.'
      );
    }

    this.currentStepIndex++;
    this.notify();
  }

  public startAutoPlay(intervalMs: number = 2500) {
    this.isAutoPlaying = true;
    const runNext = async () => {
      if (!this.isAutoPlaying) return;
      if (this.currentStepIndex < this.steps.length) {
        await this.advanceStep();
        this.autoPlayTimer = setTimeout(runNext, intervalMs);
      } else {
        this.isAutoPlaying = false;
        this.notify();
      }
    };
    runNext();
  }

  public stopAutoPlay() {
    this.isAutoPlaying = false;
    if (this.autoPlayTimer) clearTimeout(this.autoPlayTimer);
    this.notify();
  }

  public isRunning(): boolean {
    return this.isAutoPlaying;
  }
}

export const demoSimulator = new DemoSimulator();
