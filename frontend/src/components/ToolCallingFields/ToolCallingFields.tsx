import type { ServingProfileConfig } from '../../api/client'
import { TERM_HINTS } from '../../utils/labels'
import { parserOptionsFor, readToolCalling, writeToolCalling } from '../../utils/toolCalling'
import { Checkbox } from '../Checkbox/Checkbox'
import { SelectField } from '../SelectField/SelectField'
import { TermLabel } from '../TermLabel/TermLabel'

type EngineOptions = ServingProfileConfig['engine_options']

interface ToolCallingFieldsProps {
  engineOptions: EngineOptions
  onEngineOptionsChange: (engineOptions: EngineOptions) => void
}

// The registration wizard's two tool-calling controls, rendered as two
// cells of the Customise grid. They read and write the draft's own
// engine_options (utils/toolCalling.ts) -- every other option in it is
// left exactly as it was. The parser dropdown stays disabled until auto
// tool choice is on, since vLLM only uses a parser together with that
// flag.
export function ToolCallingFields({ engineOptions, onEngineOptionsChange }: ToolCallingFieldsProps) {
  const { autoToolChoice, parser } = readToolCalling(engineOptions)
  const needsParser = autoToolChoice && parser === null

  return (
    <>
      <div>
        <span className="text-xs text-muted-foreground">
          <TermLabel hint={TERM_HINTS.toolCalling}>Auto tool choice</TermLabel>
        </span>
        <label className="mt-1 flex h-9 items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={autoToolChoice}
            onChange={(event) =>
              onEngineOptionsChange(
                writeToolCalling(engineOptions, {
                  autoToolChoice: event.target.checked,
                  parser: event.target.checked ? parser : null,
                }),
              )
            }
          />
          {autoToolChoice ? 'On' : 'Off'}
        </label>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Tool call parser</span>
        <SelectField
          className="mt-1 w-full"
          value={parser ?? ''}
          disabled={!autoToolChoice}
          invalid={needsParser}
          placeholder="Select a parser…"
          onValueChange={(value) =>
            onEngineOptionsChange(writeToolCalling(engineOptions, { autoToolChoice: true, parser: value }))
          }
          groups={[{ options: parserOptionsFor(parser).map((name) => ({ value: name, label: name })) }]}
          aria-label="Tool call parser"
        />
        {needsParser && <p className="mt-1 text-xs text-danger">Choose a parser to use auto tool choice.</p>}
      </div>
    </>
  )
}
