import { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zoneQueries } from '#/queries/zones'
import {
  createZoneFn,
  updateZoneFn,
  deleteZoneFn,
  toggleZoneActiveFn,
} from '#/server/zones/zones.functions'
import type { ServiceZone, GeoJSONPolygon } from '#/db/schema/zones'
import {
  geoJsonRingToLeaflet,
  leafletRingToGeoJson,
  validateZonePolygon,
} from '#/lib/geo-utils'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'

const ZoneMapEditor = lazy(() =>
  import('./zone-map-editor').then((m) => ({ default: m.ZoneMapEditor })),
)

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Map as MapIcon,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export function ServiceZonesPanel() {
  const queryClient = useQueryClient()
  const { data: zones = [], isLoading } = useQuery(zoneQueries.all())

  // Selected zone being edited, or null for creating a new zone or browsing
  const [selectedZone, setSelectedZone] = useState<ServiceZone | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formName, setFormName] = useState('')
  const [formIsActive, setFormIsActive] = useState(false)
  const [currentRing, setCurrentRing] = useState<[number, number][]>([])
  const [initialRing, setInitialRing] = useState<[number, number][]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  // Dialogs
  const [deleteConfirmZone, setDeleteConfirmZone] = useState<ServiceZone | null>(null)
  const [unsavedWarningTarget, setUnsavedWarningTarget] = useState<(() => void) | null>(null)

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing) return false
    const nameChanged = selectedZone ? formName !== selectedZone.name : formName.trim().length > 0
    const activeChanged = selectedZone ? formIsActive !== selectedZone.isActive : formIsActive
    const ringChanged = JSON.stringify(currentRing) !== JSON.stringify(initialRing)
    return nameChanged || activeChanged || ringChanged
  }, [isEditing, selectedZone, formName, formIsActive, currentRing, initialRing])

  // Select a zone from table or map
  const handleSelectZone = useCallback(
    (zone: ServiceZone) => {
      const selectAction = () => {
        setSelectedZone(zone)
        setFormName(zone.name)
        setFormIsActive(zone.isActive)
        const coords = zone.polygon.coordinates[0]
        const ring = geoJsonRingToLeaflet(coords)
        setCurrentRing(ring)
        setInitialRing(ring)
        setIsEditing(true)
        setValidationError(null)
      }

      if (hasUnsavedChanges) {
        setUnsavedWarningTarget(() => selectAction)
      } else {
        selectAction()
      }
    },
    [hasUnsavedChanges],
  )

  // Start new zone creation
  const handleStartCreate = useCallback(() => {
    const createAction = () => {
      setSelectedZone(null)
      setFormName('')
      setFormIsActive(true)
      setCurrentRing([])
      setInitialRing([])
      setIsEditing(true)
      setValidationError(null)
    }

    if (hasUnsavedChanges) {
      setUnsavedWarningTarget(() => createAction)
    } else {
      createAction()
    }
  }, [hasUnsavedChanges])

  // Cancel editing
  const handleCancel = useCallback(() => {
    const cancelAction = () => {
      setIsEditing(false)
      setSelectedZone(null)
      setFormName('')
      setCurrentRing([])
      setInitialRing([])
      setValidationError(null)
    }

    if (hasUnsavedChanges) {
      setUnsavedWarningTarget(() => cancelAction)
    } else {
      cancelAction()
    }
  }, [hasUnsavedChanges])

  // Mutation: Save Zone (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      setValidationError(null)

      if (!formName.trim() || formName.trim().length < 2) {
        throw new Error('Please provide a zone name of at least 2 characters.')
      }

      if (currentRing.length < 4) {
        throw new Error(
          'A polygon requires at least 4 coordinate vertices (including the closing vertex). Please draw or adjust the shape on the map.',
        )
      }

      // Convert Leaflet [lat, lng] ring to GeoJSON [lng, lat]
      const geoJsonCoords = leafletRingToGeoJson(currentRing)
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: [geoJsonCoords],
      }

      // Validate geometry
      const validation = validateZonePolygon(polygon)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid polygon geometry')
      }

      if (selectedZone) {
        return await updateZoneFn({
          data: {
            id: selectedZone.id,
            name: formName.trim(),
            polygon,
            isActive: formIsActive,
          },
        })
      } else {
        return await createZoneFn({
          data: {
            name: formName.trim(),
            polygon,
            isActive: formIsActive,
          },
        })
      }
    },
    onSuccess: (savedZone) => {
      toast.success(
        selectedZone
          ? `Updated service zone "${savedZone.name}"`
          : `Created service zone "${savedZone.name}"`,
      )
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      setIsEditing(false)
      setSelectedZone(null)
      setValidationError(null)
    },
    onError: (err: any) => {
      const message = err?.message || 'Failed to save service zone'
      setValidationError(message)
      toast.error(message)
    },
  })

  // Mutation: Toggle Active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await toggleZoneActiveFn({ data: { id, isActive } })
    },
    onSuccess: (updated) => {
      toast.success(
        `Zone "${updated.name}" is now ${updated.isActive ? 'active' : 'inactive'}`,
      )
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to toggle zone active state')
    },
  })

  // Mutation: Delete Zone
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteZoneFn({ data: { id } })
    },
    onSuccess: () => {
      toast.success('Service zone deleted successfully')
      if (selectedZone?.id === deleteConfirmZone?.id) {
        setIsEditing(false)
        setSelectedZone(null)
        setCurrentRing([])
      }
      setDeleteConfirmZone(null)
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete service zone')
    },
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" />
            <span>Service Zones</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Define and manage allowed delivery regions. The public map and order validation lock to all active zones.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            onClick={handleStartCreate}
            size="sm"
            className="gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Zone</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Map Editor + Zone Management Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Leaflet Map Editor */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
            <ZoneMapEditor
              zones={zones}
              selectedZone={selectedZone}
              currentRing={currentRing}
              onRingChange={setCurrentRing}
              onSelectZone={handleSelectZone}
              onStartNewZone={handleStartCreate}
              isEditing={isEditing}
              validationError={validationError}
            />
          </Suspense>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
            <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              Use the toolbar buttons on the map to draw new polygons, drag existing vertices, or add vertices by clicking midpoint markers.
            </span>
          </div>
        </div>

        {/* Right Column: Zone Editor / Details Card */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <Card className="border border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>
                    {isEditing
                      ? selectedZone
                        ? 'Edit Service Zone'
                        : 'Create New Zone'
                      : 'Zone Inspector'}
                  </span>
                </CardTitle>
                {selectedZone && (
                  <Badge variant={selectedZone.isActive ? 'default' : 'secondary'} className="text-[11px]">
                    {selectedZone.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {isEditing
                  ? 'Adjust polygon vertices on the map and configure zone settings.'
                  : 'Select any zone from the map or list below to inspect or edit.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {isEditing ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="zone-name" className="text-xs font-medium">
                      Zone Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="zone-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Butwal Central & Tilottama"
                      className="h-9 text-xs"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                    <div className="space-y-0.5">
                      <Label htmlFor="zone-active" className="text-xs font-medium cursor-pointer">
                        Active in Service Area
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        When enabled, customers can place orders within this polygon.
                      </p>
                    </div>
                    <Switch
                      id="zone-active"
                      checked={formIsActive}
                      onCheckedChange={setFormIsActive}
                    />
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/10 p-2.5 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Coordinates count:</span>
                      <span className="font-semibold text-foreground">
                        {currentRing.length} points
                      </span>
                    </div>
                    {selectedZone && (
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>Zone ID:</span>
                        <span className="truncate max-w-[160px]">{selectedZone.id}</span>
                      </div>
                    )}
                  </div>

                  {validationError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || currentRing.length < 4}
                      size="sm"
                      className="flex-1 gap-1.5 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{saveMutation.isPending ? 'Saving...' : 'Save Zone'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      size="sm"
                      className="cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Click any zone on the map or click <b>Edit</b> in the table below to modify its boundaries.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartCreate}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    <span>Create Zone</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Table: All Configured Service Zones */}
      <Card className="border border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Configured Service Zones</CardTitle>
          <CardDescription className="text-xs">
            Overview of all active and inactive delivery zones stored in Neon Postgres.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading service zones from database...
            </div>
          ) : zones.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <p>No service zones found in database.</p>
              <Button size="sm" onClick={handleStartCreate} variant="outline">
                Add first zone
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%] text-xs">Name</TableHead>
                    <TableHead className="text-xs">Vertices</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Active Toggle</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => {
                    const vertexCount = zone.polygon.coordinates[0]?.length ?? 0
                    const isSelected = selectedZone?.id === zone.id

                    return (
                      <TableRow
                        key={zone.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5 font-medium' : ''
                        }`}
                        onClick={() => handleSelectZone(zone)}
                      >
                        <TableCell className="text-xs font-medium py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                zone.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span>{zone.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3 font-mono">
                          {vertexCount} pts
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant={zone.isActive ? 'default' : 'secondary'}
                            className="text-[10px] uppercase font-mono"
                          >
                            {zone.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={zone.isActive}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: zone.id, isActive: checked })
                            }
                            disabled={toggleMutation.isPending}
                          />
                        </TableCell>
                        <TableCell
                          className="text-right py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSelectZone(zone)}
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmZone(zone)}
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmZone)}
        onOpenChange={(open) => !open && setDeleteConfirmZone(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Service Zone</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1.5">
              Are you sure you want to delete the zone{' '}
              <b>"{deleteConfirmZone?.name}"</b>? Customers in this region will immediately no longer be able to place orders if there are no other active zones covering it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmZone(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmZone) {
                  deleteMutation.mutate(deleteConfirmZone.id)
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={Boolean(unsavedWarningTarget)}
        onOpenChange={(open) => !open && setUnsavedWarningTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Unsaved Changes</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1.5">
              You have unsaved edits on the current zone polygon or details. Do you want to discard your changes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUnsavedWarningTarget(null)}
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (unsavedWarningTarget) {
                  unsavedWarningTarget()
                  setUnsavedWarningTarget(null)
                }
              }}
            >
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
