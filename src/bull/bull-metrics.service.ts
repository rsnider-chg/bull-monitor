import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectMetrics, MetricsService } from "../metrics";
import { InjectLogger, LoggerService } from "../logger";
import { EVENT_TYPES } from "./bull.enums";
import { QueueCreatedEvent, QueueRemovedEvent } from "./bull.interfaces";
import { init } from "bull-prom";
import { ConfigService } from "../config/config.service";

@Injectable()
export class BullMetricsService {
    private readonly _queues: { [queueName: string]: ReturnType<ReturnType<typeof init>['start']> } = {};
    private readonly queueMetrics: ReturnType<typeof init>;

    constructor(
        @InjectMetrics()
        private readonly metricsService: MetricsService,
        @InjectLogger(BullMetricsService)
        private readonly logger: LoggerService,
        configService: ConfigService
    ) {
        this.logger.debug(`Checking queue metrics every ${configService.config.BULL_COLLECT_QUEUE_METRICS_INTERVAL_MS}ms`)
        this.queueMetrics = init({
            promClient: metricsService.promClient,
            interval: configService.config.BULL_COLLECT_QUEUE_METRICS_INTERVAL_MS,
        });
    }

    @OnEvent(EVENT_TYPES.QUEUE_CREATED)
    private addQueueMetrics(event: QueueCreatedEvent) {
        this.logger.log(`Adding queue metrics for ${event.uniqueName}`);
        this._queues[event.uniqueName] = this.queueMetrics.start(event.queue);
    }

    @OnEvent(EVENT_TYPES.QUEUE_REMOVED)
    private removeQueueMetrics(event: QueueRemovedEvent) {
        this.logger.log(`Removing queue metrics for ${event.uniqueName}`)
        this._queues[event.uniqueName].remove();
        delete this._queues[event.uniqueName];
    }
}