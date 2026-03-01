import { CommonModule } from '@angular/common';
import { Component, ViewChild, signal } from '@angular/core';
import { ChatComponent } from './components/chat/chat.component';
import { HeaderComponent } from './components/header/header.component';
import { RecentTasksComponent } from './components/recent-tasks/recent-tasks.component';
import { StatusComponent } from './components/status/status.component';
import { UploadComponent } from './components/upload/upload.component';

interface HeroMetric {
  label: string;
  value: string;
}

interface AmdSpotlight {
  id: string;
  family: string;
  product: string;
  tagline: string;
  description: string;
  demoFit: string[];
  badge: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    UploadComponent,
    StatusComponent,
    ChatComponent,
    RecentTasksComponent
  ],
  template: `
    <div class="app-shell">
      <app-header />

      <main class="experience">
        <section class="hero container">
          <div class="hero-copy">
            <span class="eyebrow">Hackathon Demo Cockpit</span>
            <h1>Turn dense research PDFs into a cinematic, citation-grounded workspace.</h1>
            <p class="hero-text">
              This experience now reads like a live product demo: ingest papers, monitor extraction,
              ask evidence-backed questions, and frame the story around AMD-ready AI deployment paths.
            </p>

            <div class="hero-actions">
              <a class="hero-btn hero-btn-primary" href="#workspace">Open Workspace</a>
              <a class="hero-btn hero-btn-secondary" href="#amd-showcase">View AMD Showcase</a>
            </div>

            <div class="hero-metrics">
              @for (metric of metrics; track metric.label) {
                <div class="metric-card">
                  <span class="metric-value">{{ metric.value }}</span>
                  <span class="metric-label">{{ metric.label }}</span>
                </div>
              }
            </div>
          </div>

          <div class="hero-stage">
            <div class="ambient ambient-one"></div>
            <div class="ambient ambient-two"></div>
            <div class="hero-panel">
              <div class="panel-topline">
                <span class="panel-label">{{ activeSpotlightCard().family }}</span>
                <span class="panel-badge">{{ activeSpotlightCard().badge }}</span>
              </div>

              <h2>{{ activeSpotlightCard().product }}</h2>
              <p class="panel-tagline">{{ activeSpotlightCard().tagline }}</p>
              <p class="panel-description">{{ activeSpotlightCard().description }}</p>

              <div class="fit-grid">
                @for (point of activeSpotlightCard().demoFit; track point) {
                  <div class="fit-pill">{{ point }}</div>
                }
              </div>

              <div class="selector-strip">
                @for (card of amdSpotlights; track card.id; let i = $index) {
                  <button
                    class="selector-chip"
                    [class.active]="i === activeSpotlightIndex()"
                    (click)="selectSpotlight(i)"
                    type="button"
                  >
                    {{ card.family }}
                  </button>
                }
              </div>
            </div>
          </div>
        </section>

        <section class="amd-showcase container" id="amd-showcase">
          <div class="section-heading">
            <span class="eyebrow">AMD Bonus Narrative</span>
            <h2>Map the same app to multiple AMD product stories during the pitch.</h2>
            <p>
              These cards are intentionally framed as demo positioning, not implementation claims.
              They give you a clean way to talk about edge devices, workstations, servers, and accelerators.
            </p>
          </div>

          <div class="showcase-grid">
            @for (card of amdSpotlights; track card.id; let i = $index) {
              <button
                class="showcase-card"
                [class.active]="i === activeSpotlightIndex()"
                (click)="selectSpotlight(i)"
                type="button"
              >
                <span class="showcase-family">{{ card.family }}</span>
                <h3>{{ card.product }}</h3>
                <p>{{ card.tagline }}</p>
              </button>
            }
          </div>
        </section>

        <section class="workspace container" id="workspace">
          <div class="section-heading">
            <span class="eyebrow">Research Ops Console</span>
            <h2>Everything needed for a polished live demo.</h2>
            <p>
              The upload, status, chat, and recent activity flows stay intact, but the presentation
              now feels like a real product surface rather than a utility dashboard.
            </p>
          </div>

          <div class="workspace-grid">
            <div class="stack">
              <app-upload (taskUploaded)="onTaskUploaded($event)" />
              <app-status #statusComponent />
            </div>

            <div class="stack">
              <app-chat #chatComponent />
            </div>
          </div>

          <div class="recent-shell">
            <app-recent-tasks
              (checkStatus)="onCheckStatus($event)"
              (useInChat)="onUseInChat($event)"
            />
          </div>
        </section>
      </main>

      <footer class="footer">
        <p>Research Assistant for hackathon demos. AMD showcase profiles: Ryzen AI, Radeon PRO, EPYC, and Instinct.</p>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }

    .app-shell {
      min-height: 100vh;
      color: var(--color-ink);
    }

    .experience {
      padding: 0 0 4rem;
    }

    .container {
      width: min(1180px, calc(100vw - 2rem));
      margin: 0 auto;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 2rem;
      align-items: center;
      padding-top: 2.5rem;
    }

    .hero-copy {
      position: relative;
      z-index: 1;
      animation: reveal-up 0.8s ease both;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: rgba(252, 92, 44, 0.1);
      border: 1px solid rgba(252, 92, 44, 0.18);
      color: var(--color-accent-deep);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 1.15rem 0 1rem;
      font-family: var(--font-display);
      font-size: clamp(2.8rem, 6vw, 5rem);
      line-height: 0.95;
      letter-spacing: -0.05em;
      max-width: 11ch;
    }

    .hero-text {
      max-width: 58ch;
      margin: 0;
      color: var(--color-muted);
      font-size: 1.05rem;
      line-height: 1.75;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      margin-top: 1.6rem;
    }

    .hero-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 180px;
      padding: 0.95rem 1.25rem;
      border-radius: 999px;
      border: 1px solid transparent;
      font-weight: 700;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    }

    .hero-btn:hover {
      transform: translateY(-2px);
      text-decoration: none;
    }

    .hero-btn-primary {
      background: linear-gradient(135deg, var(--color-accent) 0%, #ff8b53 100%);
      box-shadow: 0 18px 40px rgba(252, 92, 44, 0.22);
      color: #fff;
    }

    .hero-btn-secondary {
      border-color: rgba(18, 32, 58, 0.14);
      background: rgba(255, 255, 255, 0.7);
      color: var(--color-ink);
    }

    .hero-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
      margin-top: 1.8rem;
    }

    .metric-card {
      padding: 1rem;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow: 0 16px 40px rgba(24, 35, 52, 0.08);
      backdrop-filter: blur(16px);
    }

    .metric-value {
      display: block;
      font-family: var(--font-display);
      font-size: 1.7rem;
      font-weight: 700;
      letter-spacing: -0.04em;
    }

    .metric-label {
      display: block;
      margin-top: 0.2rem;
      color: var(--color-muted);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hero-stage {
      position: relative;
      min-height: 520px;
      animation: reveal-up 0.95s ease 0.1s both;
    }

    .ambient {
      position: absolute;
      border-radius: 999px;
      filter: blur(12px);
      opacity: 0.75;
      animation: drift 12s ease-in-out infinite;
    }

    .ambient-one {
      inset: 8% 10% auto auto;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(252, 92, 44, 0.35) 0%, rgba(252, 92, 44, 0) 70%);
    }

    .ambient-two {
      inset: auto auto 8% 4%;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, rgba(26, 145, 255, 0.22) 0%, rgba(26, 145, 255, 0) 72%);
      animation-delay: -5s;
    }

    .hero-panel {
      position: absolute;
      inset: 2rem 0 0;
      padding: 2rem;
      border-radius: 32px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(248, 243, 237, 0.88) 100%);
      border: 1px solid rgba(255, 255, 255, 0.75);
      box-shadow: 0 28px 80px rgba(22, 34, 49, 0.16);
      backdrop-filter: blur(22px);
      overflow: hidden;
    }

    .hero-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(252, 92, 44, 0.08), transparent 46%),
        radial-gradient(circle at top right, rgba(26, 145, 255, 0.12), transparent 34%);
      pointer-events: none;
    }

    .panel-topline,
    .fit-grid,
    .selector-strip,
    .hero-panel h2,
    .panel-tagline,
    .panel-description {
      position: relative;
      z-index: 1;
    }

    .panel-topline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }

    .panel-label,
    .panel-badge {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .panel-label {
      background: rgba(18, 32, 58, 0.08);
      color: var(--color-ink);
    }

    .panel-badge {
      background: rgba(252, 92, 44, 0.12);
      color: var(--color-accent-deep);
    }

    .hero-panel h2 {
      margin: 1.1rem 0 0.55rem;
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 0.98;
      letter-spacing: -0.05em;
      max-width: 10ch;
    }

    .panel-tagline {
      margin: 0;
      color: var(--color-accent-deep);
      font-size: 1.05rem;
      font-weight: 700;
    }

    .panel-description {
      margin: 1rem 0 0;
      color: var(--color-muted);
      line-height: 1.75;
      max-width: 48ch;
    }

    .fit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 1.6rem;
    }

    .fit-pill {
      padding: 0.85rem 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(18, 32, 58, 0.08);
      color: var(--color-ink);
      font-size: 0.92rem;
      box-shadow: 0 10px 24px rgba(22, 34, 49, 0.08);
    }

    .selector-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      margin-top: 1.6rem;
    }

    .selector-chip {
      border: 1px solid rgba(18, 32, 58, 0.12);
      background: rgba(255, 255, 255, 0.54);
      color: var(--color-muted);
      border-radius: 999px;
      padding: 0.72rem 1rem;
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
    }

    .selector-chip:hover,
    .selector-chip.active {
      transform: translateY(-2px);
      border-color: rgba(252, 92, 44, 0.32);
      background: rgba(252, 92, 44, 0.12);
      color: var(--color-accent-deep);
    }

    .amd-showcase,
    .workspace {
      margin-top: 4.5rem;
    }

    .section-heading {
      max-width: 62ch;
      margin-bottom: 1.5rem;
    }

    .section-heading h2 {
      margin: 1rem 0 0.55rem;
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .section-heading p {
      margin: 0;
      color: var(--color-muted);
      line-height: 1.75;
    }

    .showcase-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }

    .showcase-card {
      text-align: left;
      padding: 1.15rem;
      border-radius: 24px;
      border: 1px solid rgba(18, 32, 58, 0.1);
      background: rgba(255, 255, 255, 0.7);
      box-shadow: 0 18px 38px rgba(22, 34, 49, 0.08);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }

    .showcase-card:hover,
    .showcase-card.active {
      transform: translateY(-4px);
      border-color: rgba(252, 92, 44, 0.28);
      box-shadow: 0 24px 48px rgba(22, 34, 49, 0.12);
    }

    .showcase-family {
      display: inline-flex;
      margin-bottom: 0.85rem;
      color: var(--color-accent-deep);
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .showcase-card h3 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.35rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .showcase-card p {
      margin: 0.75rem 0 0;
      color: var(--color-muted);
      line-height: 1.65;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
      gap: 1.25rem;
      align-items: start;
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .recent-shell {
      margin-top: 1.25rem;
    }

    .footer {
      padding: 2rem 1rem 2.5rem;
      text-align: center;
    }

    .footer p {
      margin: 0;
      color: var(--color-muted);
      font-size: 0.88rem;
    }

    @keyframes reveal-up {
      from {
        opacity: 0;
        transform: translateY(26px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes drift {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(0, -14px, 0) scale(1.05);
      }
    }

    @media (max-width: 1080px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .hero-stage {
        min-height: 480px;
      }

      .showcase-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .workspace-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .container {
        width: min(1180px, calc(100vw - 1rem));
      }

      .experience {
        padding-bottom: 3rem;
      }

      .hero {
        padding-top: 1.35rem;
      }

      .hero-metrics,
      .fit-grid,
      .showcase-grid {
        grid-template-columns: 1fr;
      }

      .hero-panel {
        inset: 1rem 0 0;
        padding: 1.4rem;
      }

      .panel-topline {
        flex-direction: column;
        align-items: flex-start;
      }

      .hero-actions {
        flex-direction: column;
      }

      .hero-btn {
        width: 100%;
      }
    }
  `]
})
export class AppComponent {
  @ViewChild('statusComponent') statusComponent!: StatusComponent;
  @ViewChild('chatComponent') chatComponent!: ChatComponent;

  readonly metrics: HeroMetric[] = [
    { value: '4', label: 'Section Views' },
    { value: '3', label: 'Query Modes' },
    { value: 'Live', label: 'Task Telemetry' }
  ];

  readonly amdSpotlights: AmdSpotlight[] = [
    {
      id: 'ryzen-ai',
      family: 'Ryzen AI',
      product: 'AMD Ryzen AI 300 Series',
      tagline: 'Pitch private document intelligence on AI PCs.',
      description: 'Use this storyline when you want the app to feel local-first, privacy-aware, and demo friendly on a laptop during judging.',
      demoFit: ['On-device paper triage', 'Private summarization story', 'Fast startup for live demos', 'Edge AI positioning'],
      badge: 'Edge AI PC'
    },
    {
      id: 'radeon-pro',
      family: 'Radeon PRO',
      product: 'AMD Radeon PRO and Radeon AI PRO',
      tagline: 'Frame the experience for visual workstations and creator tools.',
      description: 'This works well if your pitch leans into heavy document review, chart extraction, and interactive analysis on professional desktops.',
      demoFit: ['Workstation workflow', 'Visual PDF analysis', 'Creator and research teams', 'Desktop AI acceleration story'],
      badge: 'Studio Workstation'
    },
    {
      id: 'epyc',
      family: 'EPYC',
      product: 'AMD EPYC 9005 Series',
      tagline: 'Talk about scale when the backend needs multi-user ingestion.',
      description: 'Choose this profile when the judging angle is throughput: background processing, concurrent indexing, and large document collections.',
      demoFit: ['Async ingestion queues', 'Multi-user deployments', 'Backend indexing scale', 'Hackathon to production path'],
      badge: 'Server Scale'
    },
    {
      id: 'instinct',
      family: 'Instinct',
      product: 'AMD Instinct MI300 Series',
      tagline: 'Use this when the conversation turns to model serving and RAG infrastructure.',
      description: 'This narrative lets you connect the polished frontend to a future accelerator-backed serving layer without overclaiming current implementation.',
      demoFit: ['Model serving roadmap', 'Accelerator-backed RAG', 'High-throughput inference story', 'Datacenter AI credibility'],
      badge: 'Accelerator Story'
    }
  ];

  readonly activeSpotlightIndex = signal(0);

  activeSpotlightCard(): AmdSpotlight {
    return this.amdSpotlights[this.activeSpotlightIndex()];
  }

  selectSpotlight(index: number): void {
    this.activeSpotlightIndex.set(index);
  }

  onTaskUploaded(event: { taskId: string; docId?: string }): void {
    this.statusComponent.setTaskId(event.taskId);
    if (event.docId) {
      this.chatComponent.setDocId(event.docId);
    }
  }

  onCheckStatus(taskId: string): void {
    this.statusComponent.setTaskId(taskId);
  }

  onUseInChat(docId: string): void {
    this.chatComponent.setDocId(docId);
  }
}
