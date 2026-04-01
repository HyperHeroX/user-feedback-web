import { ResponseStore } from '../utils/response-store';
import { initDatabase, closeDatabase } from '../utils/database';

describe('ResponseStore', () => {
  let store: ResponseStore;

  beforeEach(() => {
    initDatabase();
    store = new ResponseStore(3600);
  });

  afterAll(() => {
    closeDatabase();
  });

  test('should save and retrieve a pending response by project', () => {
    const id = store.save({
      sessionId: 'sess-1',
      projectId: 'proj-1',
      projectName: 'TestProject',
      feedback: [{ text: 'LGTM', images: [], timestamp: Date.now(), sessionId: 'sess-1' }],
      feedbackUrl: 'http://localhost:5050/?session=sess-1',
    });

    expect(id).toBeTruthy();

    const result = store.getByProject('proj-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.projectId).toBe('proj-1');
    expect(result!.feedback).toHaveLength(1);
    expect(result!.feedback[0].text).toBe('LGTM');
  });

  test('should return null when no pending response for project', () => {
    const result = store.getByProject('nonexistent');
    expect(result).toBeNull();
  });

  test('should mark response as delivered and not return it again', () => {
    const id = store.save({
      sessionId: 'sess-2',
      projectId: 'proj-2',
      projectName: 'TestProject2',
      feedback: [{ text: 'ok', images: [], timestamp: Date.now(), sessionId: 'sess-2' }],
      feedbackUrl: 'http://localhost:5050/?session=sess-2',
    });

    store.markDelivered(id);

    const result = store.getByProject('proj-2');
    expect(result).toBeNull();
  });

  test('should retrieve by id', () => {
    const id = store.save({
      sessionId: 'sess-3',
      projectId: 'proj-3',
      projectName: 'Test3',
      feedback: [{ text: 'hello', images: [], timestamp: Date.now(), sessionId: 'sess-3' }],
      feedbackUrl: 'http://localhost:5050',
    });

    const result = store.getById(id);
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('sess-3');
  });

  test('should return a response when multiple exist for same project', () => {
    store.save({
      sessionId: 'sess-old',
      projectId: 'proj-multi',
      projectName: 'Multi',
      feedback: [{ text: 'old', images: [], timestamp: Date.now(), sessionId: 'sess-old' }],
      feedbackUrl: 'http://localhost:5050',
    });

    store.save({
      sessionId: 'sess-new',
      projectId: 'proj-multi',
      projectName: 'Multi',
      feedback: [{ text: 'new', images: [], timestamp: Date.now(), sessionId: 'sess-new' }],
      feedbackUrl: 'http://localhost:5050',
    });

    const result = store.getByProject('proj-multi');
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe('proj-multi');
  });

  test('cleanup should remove expired responses', () => {
    const expiredStore = new ResponseStore(-1);
    expiredStore.save({
      sessionId: 'sess-exp',
      projectId: 'proj-exp',
      projectName: 'Expired',
      feedback: [{ text: 'expired', images: [], timestamp: Date.now(), sessionId: 'sess-exp' }],
      feedbackUrl: 'http://localhost:5050',
    });

    const cleaned = expiredStore.cleanup();
    expect(cleaned).toBeGreaterThanOrEqual(1);

    const result = expiredStore.getByProject('proj-exp');
    expect(result).toBeNull();
  });
});
