import axios, { type AxiosInstance } from 'axios'
import { loadBcaConfigFromEnv } from './bca.config'
import type { BcaConfig } from './interfaces/bca-config.interface'
import { BcaAuthService } from './bca-auth.service'
import { BcaStatementService } from './bca-statement.service'

export interface BcaClient {
  config: BcaConfig
  http: AxiosInstance
  auth: BcaAuthService
  statement: BcaStatementService
}

export function createBcaHttpClient(config: BcaConfig): AxiosInstance {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    headers: {
      Accept: 'application/json',
    },
  })
}

export function createBcaClient(configOverrides?: Partial<BcaConfig>): BcaClient {
  const config = loadBcaConfigFromEnv(configOverrides)
  const http = createBcaHttpClient(config)
  const auth = new BcaAuthService(config, http)
  const statement = new BcaStatementService(config, http, auth)

  return { config, http, auth, statement }
}
