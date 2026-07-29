interface CampaignScheduleFieldsProps {
  idPrefix: string;
  startAtValue: string;
  endAtValue: string;
  onStartAtChange: (value: string) => void;
  onEndAtChange: (value: string) => void;
  endAtRequired?: boolean;
}

/** Start/end `datetime-local` pair - identical shape across every campaign type. Values are already-converted local-input strings (see lib/dateTimeInput); this component only renders the inputs. */
export function CampaignScheduleFields({
  idPrefix,
  startAtValue,
  endAtValue,
  onStartAtChange,
  onEndAtChange,
  endAtRequired,
}: CampaignScheduleFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-xs text-text-secondary" htmlFor={`start-${idPrefix}`}>
          Starts (optional)
        </label>
        <input
          id={`start-${idPrefix}`}
          type="datetime-local"
          value={startAtValue}
          onChange={(event) => onStartAtChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary" htmlFor={`end-${idPrefix}`}>
          Ends {endAtRequired ? '' : '(optional)'}
        </label>
        <input
          id={`end-${idPrefix}`}
          type="datetime-local"
          value={endAtValue}
          onChange={(event) => onEndAtChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
