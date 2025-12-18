import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { EmbeddingModule } from './embedding/embedding.module';

@Module({
    imports: [AppConfigModule, EmbeddingModule],
    controllers: [],
    providers: []
})
export class AppModule {}
