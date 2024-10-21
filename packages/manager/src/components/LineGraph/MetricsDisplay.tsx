import * as React from 'react';

import { TableBody } from 'src/components/TableBody';
import { TableCell } from 'src/components/TableCell';
import { TableHead } from 'src/components/TableHead';
import { TableRow } from 'src/components/TableRow';
import { Typography } from 'src/components/Typography';

import {
  StyledButton,
  StyledTable,
  StyledTableCell,
} from './MetricDisplay.styles';

import type { Metrics } from 'src/utilities/statMetrics';

interface Props {
  hiddenRows?: string[];
  rows: MetricsDisplayRow[];
}

export interface MetricsDisplayRow {
  data: Metrics;
  format: (n: number) => string;
  handleLegendClick?: () => void;
  legendColor: string;
  legendTitle: string;
}

export const MetricsDisplay = ({ hiddenRows, rows }: Props) => {
  const rowHeaders = ['Max', 'Avg', 'Last'];
  const sxProps = {
    borderTop: 'none !important',
  };

  return (
    <StyledTable aria-label="Stats and metrics">
      <TableHead sx={sxProps}>
        <TableRow sx={sxProps}>
          <TableCell sx={sxProps}>{''}</TableCell>
          {rowHeaders.map((section, idx) => (
            <TableCell data-qa-header-cell key={idx} sx={sxProps}>
              {section}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const {
            data,
            format,
            handleLegendClick,
            legendColor,
            legendTitle,
          } = row;
          const hidden = hiddenRows?.includes(legendTitle);

          return (
            <TableRow data-qa-metric-row key={legendTitle}>
              <StyledTableCell>
                <StyledButton
                  data-testid="legend-title"
                  disableTouchRipple
                  hidden={hidden}
                  legendColor={legendColor}
                  onClick={handleLegendClick}
                >
                  <Typography component="span">{legendTitle}</Typography>
                </StyledButton>
              </StyledTableCell>
              {metricsBySection(data).map((section, idx) => {
                return (
                  <TableCell
                    data-qa-body-cell
                    data-qa-graph-column-title={rowHeaders[idx]}
                    data-qa-graph-row-title={section}
                    key={idx}
                    parentColumn={rowHeaders[idx]}
                  >
                    {format(section)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </StyledTable>
  );
};

// Grabs the sections we want (max, average, last) and puts them in an array
// so we can map through them and create JSX
export const metricsBySection = (data: Metrics): number[] => [
  data.max,
  data.average,
  data.last,
];

export default MetricsDisplay;
