import React from 'react';

export interface TallyState {
  program: boolean;
  preview: boolean;
  isoRec: boolean;
}

interface TallyBarProps {
  tally: TallyState;
  cameraId?: string;
  onSetTally?: (tally: Partial<TallyState>) => void;
}

/**
 * Sony-style tally indicator bar
 * Shows Program (red), Preview (green), and ISO recording status
 */
export function TallyBar({ tally, cameraId = 'CAM 1', onSetTally }: TallyBarProps) {
  const handleToggle = (key: keyof TallyState) => {
    if (onSetTally) {
      onSetTally({ [key]: !tally[key] });
    }
  };

  return (
    <div className={`tally-bar ${tally.program ? 'tally-bar--program' : ''} ${tally.preview ? 'tally-bar--preview' : ''}`}>
      <div className="tally-bar__left">
        <div
          className={`tally-lamp tally-lamp--program ${tally.program ? 'tally-lamp--active' : ''}`}
          onClick={() => handleToggle('program')}
          title="Program (Red Tally)"
        >
          PGM
        </div>
        <div
          className={`tally-lamp tally-lamp--preview ${tally.preview ? 'tally-lamp--active' : ''}`}
          onClick={() => handleToggle('preview')}
          title="Preview (Green Tally)"
        >
          PVW
        </div>
      </div>

      <div className="tally-bar__center">
        <span className="tally-bar__camera-id">{cameraId}</span>
      </div>

      <div className="tally-bar__right">
        <div
          className={`tally-lamp tally-lamp--iso ${tally.isoRec ? 'tally-lamp--active' : ''}`}
          onClick={() => handleToggle('isoRec')}
          title="ISO Recording"
        >
          REC
        </div>
      </div>
    </div>
  );
}
