/**
 * CLI Executor 單元測試
 * 測試 CLI 命令執行功能
 */

import {
  buildCommandArgs,
  parseOutput,
  CLIError
} from '../utils/cli-executor.js';
import type { CLIExecuteOptions, CLIToolType } from '../types/index.js';

describe('CLI Executor', () => {
  describe('buildCommandArgs', () => {
    it('應該為 gemini 建構正確的命令參數', () => {
      const options: CLIExecuteOptions = {
        tool: 'gemini',
        prompt: 'Hello world',
        outputFormat: 'text'
      };
      
      const args = buildCommandArgs(options);
      
      expect(args).toContain('-p');
      expect(args).toContain('Hello world');
      expect(args).toContain('--output-format');
      expect(args).toContain('text');
    });

    it('應該為 claude 建構正確的命令參數', () => {
      const options: CLIExecuteOptions = {
        tool: 'claude',
        prompt: 'Test prompt',
        outputFormat: 'text'
      };
      
      const args = buildCommandArgs(options);
      
      expect(args).toContain('-p');
      expect(args).toContain('Test prompt');
      expect(args).toContain('--output-format');
      expect(args).toContain('text');
    });

    it('應該使用預設 outputFormat 為 text', () => {
      const options: CLIExecuteOptions = {
        tool: 'gemini',
        prompt: 'Test'
      };
      
      const args = buildCommandArgs(options);
      
      expect(args).toContain('text');
    });

    it('應該對不支援的工具拋出 CLIError', () => {
      const options: CLIExecuteOptions = {
        tool: 'unknown-tool' as CLIToolType,
        prompt: 'Test'
      };
      
      expect(() => buildCommandArgs(options)).toThrow(CLIError);
    });
  });

  describe('parseOutput', () => {
    it('應該移除 ANSI 轉義碼', () => {
      const rawOutput = '\x1B[32mGreen text\x1B[0m Normal text';
      const result = parseOutput(rawOutput, 'gemini');
      
      expect(result).not.toContain('\x1B');
      expect(result).toContain('Green text');
      expect(result).toContain('Normal text');
    });

    it('應該修剪前後空白', () => {
      const rawOutput = '   \n  Hello World  \n   ';
      const result = parseOutput(rawOutput, 'gemini');
      
      expect(result).toBe('Hello World');
    });

    it('應該對空字串返回空字串', () => {
      const result = parseOutput('', 'gemini');
      expect(result).toBe('');
    });

    it('應該為 gemini 移除狀態訊息', () => {
      const rawOutput = `Using model: gemini-pro
Thinking...
Hello, this is the response.`;
      
      const result = parseOutput(rawOutput, 'gemini');
      
      expect(result).not.toContain('Using model');
      expect(result).not.toContain('Thinking');
      expect(result).toContain('Hello, this is the response');
    });

    it('應該為 claude 移除載入指示器', () => {
      const rawOutput = `⠋ Loading
⠙ Processing
This is the actual response.`;
      
      const result = parseOutput(rawOutput, 'claude');
      
      expect(result).not.toContain('⠋');
      expect(result).not.toContain('⠙');
      expect(result).toContain('This is the actual response');
    });

    it('應該保留多行回應內容', () => {
      const rawOutput = `Line 1
Line 2
Line 3`;
      
      const result = parseOutput(rawOutput, 'gemini');
      
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });
  });

  describe('CLIError', () => {
    it('應該正確建立錯誤實例', () => {
      const error = new CLIError('CLI_NOT_INSTALLED', 'Tool not found', { tool: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CLIError);
      expect(error.code).toBe('CLI_NOT_INSTALLED');
      expect(error.message).toBe('Tool not found');
      expect(error.details).toEqual({ tool: 'test' });
      expect(error.name).toBe('CLIError');
    });

    it('應該可以沒有 details', () => {
      const error = new CLIError('CLI_EXECUTION_FAILED', 'Execution failed');
      
      expect(error.code).toBe('CLI_EXECUTION_FAILED');
      expect(error.details).toBeUndefined();
    });
  });
});
