import { useEffect, useState } from 'react';
import type { ProgressBaselineCapture } from '@/domain/progress/progressBaseline';
import { framingSnapshotFrom, type FramingSnapshot } from '@/domain/progress/framingMatch';
import { useFaceDetector } from './FaceDetectorContext';

export type BaselineFramingState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; snapshot: FramingSnapshot | null };

/**
 * Re-derives the saved baseline photo's face framing on this device so a new
 * check-in can be lined up against it. The geometry is held in component
 * memory only: nothing is written to the baseline manifest, and the result is
 * dropped as soon as the screen using it unmounts.
 */
export function useBaselineFraming(capture: ProgressBaselineCapture | undefined): BaselineFramingState {
  const detector = useFaceDetector();
  const [state, setState] = useState<BaselineFramingState>({ status: 'idle' });
  const uri = capture?.uri;
  const width = capture?.width;
  const height = capture?.height;

  useEffect(() => {
    if (!uri || !width || !height) {
      setState({ status: 'idle' });
      return;
    }
    let active = true;
    setState({ status: 'locating' });
    detector.detect({ uri, width, height })
      .then((outcome) => {
        if (!active) return;
        setState({ status: 'ready', snapshot: framingSnapshotFrom(outcome, { width, height }) });
      })
      .catch(() => {
        if (!active) return;
        setState({ status: 'ready', snapshot: null });
      });
    return () => { active = false; };
  }, [detector, uri, width, height]);

  return state;
}
