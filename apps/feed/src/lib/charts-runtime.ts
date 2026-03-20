type ChartsRuntimeConfig = {
  wsBase: string;
  httpBase: string;
};

let runtimeConfigPromise: Promise<ChartsRuntimeConfig> | null = null;

function fallbackChartsConfig(): ChartsRuntimeConfig {
  const raw =
    process.env.NEXT_PUBLIC_CHARTS_API_URL || 'wss://noon-hub-charts-api-production.up.railway.app';

  if (raw.startsWith('wss://')) {
    return {
      wsBase: raw,
      httpBase: raw.replace(/^wss:\/\//, 'https://'),
    };
  }

  if (raw.startsWith('ws://')) {
    return {
      wsBase: raw,
      httpBase: raw.replace(/^ws:\/\//, 'http://'),
    };
  }

  if (raw.startsWith('https://')) {
    return {
      wsBase: raw.replace(/^https:\/\//, 'wss://'),
      httpBase: raw,
    };
  }

  if (raw.startsWith('http://')) {
    return {
      wsBase: raw.replace(/^http:\/\//, 'ws://'),
      httpBase: raw,
    };
  }

  return {
    wsBase: `wss://${raw}`,
    httpBase: `https://${raw}`,
  };
}

export async function getChartsRuntimeConfig(): Promise<ChartsRuntimeConfig> {
  if (typeof window === 'undefined') {
    return fallbackChartsConfig();
  }

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/charts/config', {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`config ${response.status}`);
        }
        return response.json() as Promise<ChartsRuntimeConfig>;
      })
      .catch(() => fallbackChartsConfig());
  }

  return runtimeConfigPromise;
}
