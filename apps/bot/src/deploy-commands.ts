import { REST, Routes } from 'discord.js';
import { createLogger, buildConfig } from '@crypto-news/shared';
import { data as newsCommand } from './commands/news.js';

const logger = createLogger('bot:deploy');

async function main() {
  const config = buildConfig();

  const commands = [newsCommand.toJSON()];

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    logger.info({ commandCount: commands.length }, 'Started refreshing application (/) commands');

    await rest.put(Routes.applicationGuildCommands(await getApplicationId(rest), config.discord.guildId), {
      body: commands,
    });

    logger.info('Successfully reloaded application (/) commands');
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to deploy commands');
    process.exit(1);
  }
}

async function getApplicationId(rest: REST): Promise<string> {
  const response = (await rest.get(Routes.currentApplication())) as { id: string };
  return response.id;
}

main();
