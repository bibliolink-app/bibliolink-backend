import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subscription } from "./subscription.entity.js";
import { SubscriptionService } from "./subscription.service.js";
import { SubscriptionController } from "./subscription.controller.js";

@Module({
    imports: [TypeOrmModule.forFeature([Subscription])],
    controllers: [SubscriptionController],
    providers: [SubscriptionService],
})

export class SubscriptionModule {}