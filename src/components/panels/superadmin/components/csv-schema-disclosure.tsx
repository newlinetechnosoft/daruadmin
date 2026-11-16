import { useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { ColumnSpec } from '../types'

interface CsvSchemaDisclosureProps {
  columns: ColumnSpec[]
  primaryKeyDesc: string
}

export function CsvSchemaDisclosure({
  columns,
  primaryKeyDesc,
}: CsvSchemaDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false)

  const requiredCount = columns.filter((c) => c.required).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            <span>CSV Column Schema</span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 ml-1">
              {columns.length} columns • {requiredCount} required
            </Badge>
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 ml-1 transition-transform" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform" />
            )}
          </Button>
        </CollapsibleTrigger>
        <span className="text-[11px] text-muted-foreground font-mono">
          {primaryKeyDesc}
        </span>
      </div>

      <CollapsibleContent className="pt-1">
        <div className="rounded-lg border border-border overflow-hidden bg-card/50">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold py-2 w-[160px]">Column Header</TableHead>
                <TableHead className="text-xs font-bold py-2 w-[100px]">Requirement</TableHead>
                <TableHead className="text-xs font-bold py-2 w-[110px]">Type</TableHead>
                <TableHead className="text-xs font-bold py-2">Description</TableHead>
                <TableHead className="text-xs font-bold py-2 w-[220px]">Sample Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.name} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-bold text-foreground py-2">
                    {col.name}
                  </TableCell>
                  <TableCell className="py-2">
                    {col.required ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-semibold">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        Optional
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground py-2">
                    {col.type}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2">
                    {col.desc}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-foreground/80 py-2 truncate max-w-[220px]">
                    {col.sample}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
