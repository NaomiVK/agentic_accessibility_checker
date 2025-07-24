import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  AgentCommunicationHub, 
  AgentMessage, 
  MessageType,
  MessagePriority,
  AgentCommunicator 
} from '../../src/agents/agent-communication';

describe('AgentCommunicationHub', () => {
  let hub: AgentCommunicationHub;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    hub = new AgentCommunicationHub();
    mockCallback = jest.fn();
  });

  describe('subscribe and publish', () => {
    it('should deliver messages to subscribers of specific types', () => {
      hub.subscribe('insight', mockCallback);

      const message: AgentMessage = {
        id: '123',
        timestamp: new Date().toISOString(),
        from: 'test-agent',
        type: 'insight',
        priority: 'medium',
        data: { test: 'data' }
      };

      hub.publish(message);

      expect(mockCallback).toHaveBeenCalledWith(message);
    });

    it('should not deliver messages to unsubscribed types', () => {
      hub.subscribe('alert', mockCallback);

      const message: AgentMessage = {
        id: '123',
        timestamp: new Date().toISOString(),
        from: 'test-agent',
        type: 'insight',
        priority: 'medium',
        data: { test: 'data' }
      };

      hub.publish(message);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      hub.subscribe('request', callback1);
      hub.subscribe('request', callback2);

      const message: AgentMessage = {
        id: '123',
        timestamp: new Date().toISOString(),
        from: 'test-agent',
        type: 'request',
        priority: 'high',
        data: { action: 'analyze' }
      };

      hub.publish(message);

      expect(callback1).toHaveBeenCalledWith(message);
      expect(callback2).toHaveBeenCalledWith(message);
    });
  });

  describe('message history', () => {
    it('should maintain message history', () => {
      const messages: AgentMessage[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          from: 'scanner',
          type: 'coordination',
          priority: 'medium',
          data: { progress: 50 }
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          from: 'decision',
          type: 'insight',
          priority: 'high',
          data: { pattern: 'form-issues' }
        }
      ];

      messages.forEach(msg => hub.publish(msg));

      const history = hub.getMessageHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('1');
      expect(history[1].id).toBe('2');
    });

    it('should filter message history by type', () => {
      const messages: AgentMessage[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          from: 'scanner',
          type: 'coordination',
          priority: 'medium',
          data: {}
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          from: 'decision',
          type: 'insight',
          priority: 'high',
          data: {}
        },
        {
          id: '3',
          timestamp: new Date().toISOString(),
          from: 'claude',
          type: 'insight',
          priority: 'critical',
          data: {}
        }
      ];

      messages.forEach(msg => hub.publish(msg));

      const insights = hub.getMessageHistory('insight');
      expect(insights).toHaveLength(2);
      expect(insights.every(msg => msg.type === 'insight')).toBe(true);
    });
  });

  describe('analytics', () => {
    it('should track message analytics', () => {
      const messages: AgentMessage[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          from: 'scanner',
          type: 'coordination',
          priority: 'low',
          data: {}
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          from: 'scanner',
          type: 'coordination',
          priority: 'medium',
          data: {}
        },
        {
          id: '3',
          timestamp: new Date().toISOString(),
          from: 'decision',
          type: 'request',
          priority: 'high',
          data: {}
        }
      ];

      messages.forEach(msg => hub.publish(msg));

      const analytics = hub.getAnalytics();
      
      expect(analytics.totalMessages).toBe(3);
      expect(analytics.messagesByType['coordination']).toBe(2);
      expect(analytics.messagesByType['request']).toBe(1);
      expect(analytics.messagesByAgent['scanner']).toBe(2);
      expect(analytics.messagesByAgent['decision']).toBe(1);
      expect(analytics.messagesByPriority['low']).toBe(1);
      expect(analytics.messagesByPriority['medium']).toBe(1);
      expect(analytics.messagesByPriority['high']).toBe(1);
    });
  });
});

describe('AgentCommunicator', () => {
  let hub: AgentCommunicationHub;
  let communicator: AgentCommunicator;

  beforeEach(() => {
    hub = new AgentCommunicationHub();
    communicator = new AgentCommunicator('test-agent', hub);
  });

  describe('publish convenience methods', () => {
    it('should publish insights', () => {
      const spy = jest.spyOn(hub, 'publish');
      
      communicator.publishInsight(
        { pattern: 'test-pattern' },
        'high'
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test-agent',
          type: 'insight',
          priority: 'high',
          data: { pattern: 'test-pattern' }
        })
      );
    });

    it('should publish requests', () => {
      const spy = jest.spyOn(hub, 'publish');
      
      communicator.publishRequest(
        'target-agent',
        { action: 'analyze', pages: [1, 2, 3] }
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test-agent',
          type: 'request',
          target: 'target-agent',
          data: { action: 'analyze', pages: [1, 2, 3] }
        })
      );
    });

    it('should publish alerts', () => {
      const spy = jest.spyOn(hub, 'publish');
      
      communicator.publishAlert(
        { issue: 'critical-failure', url: 'https://example.com' }
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test-agent',
          type: 'alert',
          priority: 'critical',
          data: { issue: 'critical-failure', url: 'https://example.com' }
        })
      );
    });

    it('should publish coordination messages', () => {
      const spy = jest.spyOn(hub, 'publish');
      
      communicator.publishCoordination(
        { action: 'batch', urls: ['url1', 'url2'] },
        'medium'
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test-agent',
          type: 'coordination',
          priority: 'medium',
          data: { action: 'batch', urls: ['url1', 'url2'] }
        })
      );
    });
  });

  describe('subscriptions', () => {
    it('should handle responses to requests', async () => {
      const responseHandler = jest.fn();
      communicator.onResponse(responseHandler);

      const response: AgentMessage = {
        id: '123',
        timestamp: new Date().toISOString(),
        from: 'other-agent',
        type: 'response',
        priority: 'medium',
        target: 'test-agent',
        data: { result: 'success' }
      };

      hub.publish(response);

      expect(responseHandler).toHaveBeenCalledWith(response);
    });

    it('should only handle responses targeted to the agent', () => {
      const responseHandler = jest.fn();
      communicator.onResponse(responseHandler);

      const response: AgentMessage = {
        id: '123',
        timestamp: new Date().toISOString(),
        from: 'other-agent',
        type: 'response',
        priority: 'medium',
        target: 'different-agent',
        data: { result: 'success' }
      };

      hub.publish(response);

      expect(responseHandler).not.toHaveBeenCalled();
    });
  });
});