/**
 * 基礎功能測試
 */

describe('基礎功能', () => {
  test('應該能夠執行測試', () => {
    expect(1 + 1).toBe(2);
  });

  test('應該能夠導入類型', async () => {
    const { MCPError } = await import('../types/index');
    expect(MCPError).toBeDefined();
  });
});
