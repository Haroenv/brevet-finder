import { useRange } from 'react-instantsearch';
import {
  dateStringToNum,
  dateToNum,
  dateToRatio,
  numToDateString,
  ratioToDate,
} from './date';

export function DatePicker({ attribute }: { attribute: string }) {
  const { refine, range, start } = useRange({ attribute });
  const current = {
    min: start[0],
    max: start[1],
  };

  if (
    range.min === range.max ||
    range.min === undefined ||
    range.max === undefined
  ) {
    return null;
  }

  const minFinite = current.min === -Infinity ? range.min : current.min;
  const maxFinite = current.max === Infinity ? range.max : current.max;

  const values = {
    min: Math.min(minFinite!, range.max!) || 0,
    max: Math.max(maxFinite!, range.min!) || 0,
  };
  const rangeForMin = {
    min: range.min,
    max: Math.min(range.max, values.max),
  };
  const rangeForMax = {
    min: Math.max(range.min, values.min),
    max: range.max,
  };

  return (
    <div style={{ display: 'flex' }}>
      <fieldset
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '.25em',
          border: '1px solid #d6d6e7',
          boxShadow: ' 0 1px 0 0 rgba(35, 38, 59, 0.05)',
        }}
      >
        <legend style={{ alignSelf: 'center' }}>From</legend>
        <input
          className="input"
          type="date"
          value={numToDateString(values.min)}
          onChange={(event) =>
            refine([dateStringToNum(event.target.value), values.max])
          }
          min={numToDateString(rangeForMin.min)}
          max={numToDateString(rangeForMin.max)}
        />
        <input
          type="range"
          value={dateToRatio(values.min, rangeForMin)}
          min={0}
          max={1}
          step={0.001}
          onChange={(event) =>
            refine([
              ratioToDate(Number(event.target.value), rangeForMin),
              values.max,
            ])
          }
        />
        <button
          onClick={() => refine([dateToNum(new Date()), values.max])}
          type="button"
          className={`btn ${
            values.min === dateToNum(new Date()) ? 'active' : ''
          }`}
        >
          now
        </button>
      </fieldset>
      <fieldset
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '.25em',
          border: '1px solid #d6d6e7',
          boxShadow: ' 0 1px 0 0 rgba(35, 38, 59, 0.05)',
        }}
      >
        <legend style={{ alignSelf: 'center' }}>To</legend>
        <input
          type="date"
          className="input"
          value={numToDateString(values.max)}
          onChange={(event) =>
            refine([values.min, dateStringToNum(event.target.value)])
          }
          min={numToDateString(rangeForMax.min)}
          max={numToDateString(rangeForMax.max)}
        />
        <input
          type="range"
          value={dateToRatio(values.max, rangeForMax)}
          min={0}
          max={1}
          step={0.001}
          onChange={(event) =>
            refine([
              values.min,
              ratioToDate(Number(event.target.value), rangeForMax),
            ])
          }
        />
        <button
          onClick={() => refine([values.min, dateToNum(new Date())])}
          type="button"
          className={`btn ${
            values.max === dateToNum(new Date()) ? 'active' : ''
          }`}
        >
          now
        </button>
      </fieldset>
    </div>
  );
}
