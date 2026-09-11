import React from 'react';

interface SmsPreviewProps {
  message: string;
  sampleContact?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

const SAMPLE = {
  first_name: 'Alex',
  last_name: 'Johnson',
  phone: '(409) 555-0192',
};

function interpolate(message: string, contact: typeof SAMPLE): string {
  return message
    .replace(/\{\{first_name\}\}/gi, contact.first_name)
    .replace(/\{\{last_name\}\}/gi, contact.last_name)
    .replace(/\{\{phone\}\}/gi, contact.phone)
    .replace(/\{\{name\}\}/gi, `${contact.first_name} ${contact.last_name}`);
}

const SMS_LIMIT = 160;
const SEGMENT_SIZE = 153; // GSM7 multi-part

function getSegmentInfo(msg: string) {
  const len = msg.length;
  if (len === 0) return { chars: 0, segments: 0, remaining: SMS_LIMIT };
  if (len <= SMS_LIMIT) return { chars: len, segments: 1, remaining: SMS_LIMIT - len };
  const segments = Math.ceil(len / SEGMENT_SIZE);
  return { chars: len, segments, remaining: segments * SEGMENT_SIZE - len };
}

export const SmsPreview: React.FC<SmsPreviewProps> = ({ message, sampleContact }) => {
  const contact = { ...SAMPLE, ...sampleContact };
  const rendered = interpolate(message || '', contact);
  const { chars, segments, remaining } = getSegmentInfo(rendered);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone shell */}
      <div className="relative w-[200px] h-[380px] bg-slate-900 rounded-[30px] shadow-2xl border-4 border-slate-700 flex flex-col overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-white text-[10px] font-bold">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <div className="w-2 h-2 rounded-full bg-white/60" />
          </div>
        </div>

        {/* Header bar */}
        <div className="bg-slate-800/80 px-3 py-2 flex items-center gap-2 border-b border-slate-700">
          <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            E
          </div>
          <div>
            <p className="text-white text-[10px] font-bold leading-none">Elite Phone Repair</p>
            <p className="text-slate-400 text-[9px]">SMS</p>
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 bg-slate-950 p-3 flex flex-col justify-end">
          {rendered ? (
            <div className="max-w-[80%] self-start">
              <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-3 py-2">
                <p className="text-white text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                  {rendered}
                </p>
              </div>
              <p className="text-slate-500 text-[9px] mt-1 ml-1">Delivered</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-600 text-[11px] text-center">Type a message to preview it here</p>
            </div>
          )}
        </div>
      </div>

      {/* Character count */}
      <div className="w-full flex items-center justify-between text-[11px]">
        <span className={`font-medium ${chars > SMS_LIMIT ? 'text-amber-500' : 'text-slate-400'}`}>
          {chars} characters
        </span>
        <span className={`font-bold ${segments > 1 ? 'text-amber-500' : 'text-slate-400'}`}>
          {segments > 0 ? `${segments} SMS segment${segments > 1 ? 's' : ''}` : '—'}
          {segments > 0 && ` · ${remaining} left`}
        </span>
      </div>
    </div>
  );
};
