import { describe, it, expect, vi } from 'vitest';
import { FOCUS_TASK_EVENT, dispatchFocusTask, type FocusTaskEventDetail } from '../focusTaskEvent';

describe('dispatchFocusTask', () => {
  it('dispatches a FOCUS_TASK_EVENT CustomEvent carrying the given taskId', () => {
    const handler = vi.fn();
    window.addEventListener(FOCUS_TASK_EVENT, handler);

    dispatchFocusTask('task-42');

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent<FocusTaskEventDetail>;
    expect(event.detail).toEqual({ taskId: 'task-42' });

    window.removeEventListener(FOCUS_TASK_EVENT, handler);
  });

  it('does not fire a listener for a different event name', () => {
    const handler = vi.fn();
    window.addEventListener('some-other-event', handler);

    dispatchFocusTask('task-1');

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('some-other-event', handler);
  });
});
