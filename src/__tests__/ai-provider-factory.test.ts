/**
 * AI Provider Factory 單元測試
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../utils/database.js', () => ({
  getCLISettings: jest.fn(),
  getAISettings: jest.fn(),
  createCLITerminal: jest.fn(),
  insertCLIExecutionLog: jest.fn(),
  updateCLITerminal: jest.fn(),
  getCLITerminalById: jest.fn(),
}));

jest.unstable_mockModule('../utils/cli-detector.js', () => ({
  isToolAvailable: jest.fn(),
}));

jest.unstable_mockModule('../utils/cli-executor.js', () => ({
  executeCLI: jest.fn(),
}));

jest.unstable_mockModule('../utils/mcp-client-manager.js', () => ({
  mcpClientManager: {
    getAllTools: jest.fn(() => []),
  },
}));

describe('AI Provider Factory', () => {
  let AIProviderFactory: typeof import('../utils/ai-provider-factory.js').AIProviderFactory;
  let getAIProviderFactory: typeof import('../utils/ai-provider-factory.js').getAIProviderFactory;
  let getCLISettings: jest.Mock;
  let getAISettings: jest.Mock;
  let isToolAvailable: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const dbModule = await import('../utils/database.js');
    getCLISettings = dbModule.getCLISettings as jest.Mock;
    getAISettings = dbModule.getAISettings as jest.Mock;
    
    const detectorModule = await import('../utils/cli-detector.js');
    isToolAvailable = detectorModule.isToolAvailable as jest.Mock;
    
    const factoryModule = await import('../utils/ai-provider-factory.js');
    AIProviderFactory = factoryModule.AIProviderFactory;
    getAIProviderFactory = factoryModule.getAIProviderFactory;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const factory1 = getAIProviderFactory();
      const factory2 = getAIProviderFactory();
      expect(factory1).toBe(factory2);
    });
  });

  describe('getCurrentMode', () => {
    it('should return api mode when CLI is not configured', () => {
      getCLISettings.mockReturnValue(null);
      const factory = getAIProviderFactory();
      expect(factory.getCurrentMode()).toBe('api');
    });

    it('should return api mode when aiMode is api', () => {
      getCLISettings.mockReturnValue({ aiMode: 'api' });
      const factory = getAIProviderFactory();
      expect(factory.getCurrentMode()).toBe('api');
    });

    it('should return cli mode when aiMode is cli', () => {
      getCLISettings.mockReturnValue({ aiMode: 'cli', cliTool: 'claude' });
      const factory = getAIProviderFactory();
      expect(factory.getCurrentMode()).toBe('cli');
    });
  });

  describe('getCurrentCLITool', () => {
    it('should return undefined when CLI is not configured', () => {
      getCLISettings.mockReturnValue(null);
      const factory = getAIProviderFactory();
      expect(factory.getCurrentCLITool()).toBeUndefined();
    });

    it('should return the configured CLI tool', () => {
      getCLISettings.mockReturnValue({ aiMode: 'cli', cliTool: 'gemini' });
      const factory = getAIProviderFactory();
      expect(factory.getCurrentCLITool()).toBe('gemini');
    });
  });

  describe('getProvider', () => {
    it('should return APIProvider when mode is api', async () => {
      getCLISettings.mockReturnValue({ aiMode: 'api' });
      const factory = getAIProviderFactory();
      const provider = await factory.getProvider();
      expect(provider.getMode()).toBe('api');
      expect(provider.getName()).toBe('Google Gemini API');
    });

    it('should return CLIProvider when mode is cli and tool is available', async () => {
      getCLISettings.mockReturnValue({ aiMode: 'cli', cliTool: 'claude' });
      isToolAvailable.mockResolvedValue(true);
      const factory = getAIProviderFactory();
      const provider = await factory.getProvider();
      expect(provider.getMode()).toBe('cli');
      expect(provider.getName()).toBe('CLI (claude)');
    });

    it('should fallback to APIProvider when CLI tool is not available and fallback is enabled', async () => {
      getCLISettings.mockReturnValue({ aiMode: 'cli', cliTool: 'claude', cliFallbackToApi: true });
      isToolAvailable.mockResolvedValue(false);
      const factory = getAIProviderFactory();
      const provider = await factory.getProvider();
      expect(provider.getMode()).toBe('api');
    });

    it('should throw error when CLI tool is not available and fallback is disabled', async () => {
      getCLISettings.mockReturnValue({ aiMode: 'cli', cliTool: 'claude', cliFallbackToApi: false });
      isToolAvailable.mockResolvedValue(false);
      const factory = getAIProviderFactory();
      await expect(factory.getProvider()).rejects.toThrow('CLI 工具 claude 不可用');
    });
  });
});

describe('APIProvider', () => {
  let APIProvider: typeof import('../utils/api-provider.js').APIProvider;
  let getAISettings: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const dbModule = await import('../utils/database.js');
    getAISettings = dbModule.getAISettings as jest.Mock;
    
    const providerModule = await import('../utils/api-provider.js');
    APIProvider = providerModule.APIProvider;
  });

  it('should return correct name', () => {
    const provider = new APIProvider();
    expect(provider.getName()).toBe('Google Gemini API');
  });

  it('should return correct mode', () => {
    const provider = new APIProvider();
    expect(provider.getMode()).toBe('api');
  });

  it('should be available when API key is configured', async () => {
    getAISettings.mockReturnValue({ apiKey: 'test-key' });
    const provider = new APIProvider();
    expect(await provider.isAvailable()).toBe(true);
  });

  it('should not be available when API key is not configured', async () => {
    getAISettings.mockReturnValue({ apiKey: 'YOUR_API_KEY_HERE' });
    const provider = new APIProvider();
    expect(await provider.isAvailable()).toBe(false);
  });

  it('should not be available when settings are null', async () => {
    getAISettings.mockReturnValue(null);
    const provider = new APIProvider();
    expect(await provider.isAvailable()).toBe(false);
  });
});

describe('CLIProvider', () => {
  let CLIProvider: typeof import('../utils/cli-provider.js').CLIProvider;
  let isToolAvailable: jest.Mock;
  let executeCLI: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const detectorModule = await import('../utils/cli-detector.js');
    isToolAvailable = detectorModule.isToolAvailable as jest.Mock;
    
    const executorModule = await import('../utils/cli-executor.js');
    executeCLI = executorModule.executeCLI as jest.Mock;
    
    const providerModule = await import('../utils/cli-provider.js');
    CLIProvider = providerModule.CLIProvider;
  });

  it('should return correct name with tool', () => {
    const provider = new CLIProvider({ aiMode: 'cli', cliTool: 'claude', cliTimeout: 60000 });
    expect(provider.getName()).toBe('CLI (claude)');
  });

  it('should return correct mode', () => {
    const provider = new CLIProvider({ aiMode: 'cli', cliTool: 'gemini', cliTimeout: 60000 });
    expect(provider.getMode()).toBe('cli');
  });

  it('should check tool availability', async () => {
    isToolAvailable.mockResolvedValue(true);
    const provider = new CLIProvider({ aiMode: 'cli', cliTool: 'claude', cliTimeout: 60000 });
    expect(await provider.isAvailable()).toBe(true);
    expect(isToolAvailable).toHaveBeenCalledWith('claude');
  });

  it('should return false when tool is not available', async () => {
    isToolAvailable.mockResolvedValue(false);
    const provider = new CLIProvider({ aiMode: 'cli', cliTool: 'gemini', cliTimeout: 60000 });
    expect(await provider.isAvailable()).toBe(false);
  });
});
