import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { Stage, Layer, Rect, Circle, Line, Group, Text, Arrow, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../store/boardStore'
import { useToolStore } from '../store/toolStore'
import { useUIStore, themeConfig } from '../store/uiStore'
import { sendCursor } from '../sync/socket'
import { generateId, screenToBoard } from '../lib/utils'
import type { BoardObject, ObjectType, BoardAction } from '../../shared/types'
import { STICKY_COLORS } from '../../shared/types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const SNAP_THRESHOLD = 20

interface SnapResult {
  x: number
  y: number
  targetId: string
}

function findSnapTarget(
  px: number,
  py: number,
  excludeId: string,
  objects: Map<string, BoardObject>
): SnapResult | null {
  let best: SnapResult | null = null
  let bestDist = SNAP_THRESHOLD

  objects.forEach((obj) => {
    if (obj.id === excludeId) return
    if (obj.type === 'line' || obj.type === 'connector') return

    let left: number, top: number, right: number, bottom: number
    if (obj.type === 'circle') {
      const r = obj.width / 2
      left = obj.x - r
      top = obj.y - r
      right = obj.x + r
      bottom = obj.y + r
    } else {
      left = obj.x
      top = obj.y
      right = obj.x + obj.width
      bottom = obj.y + obj.height
    }

    // Nearest point on bounding box edge
    const clampedX = Math.max(left, Math.min(right, px))
    const clampedY = Math.max(top, Math.min(bottom, py))

    let edgeX = clampedX
    let edgeY = clampedY

    // If point is inside the shape, snap to nearest edge
    if (px >= left && px <= right && py >= top && py <= bottom) {
      const dists = [
        { x: left, y: py, d: px - left },
        { x: right, y: py, d: right - px },
        { x: px, y: top, d: py - top },
        { x: px, y: bottom, d: bottom - py },
      ]
      dists.sort((a, b) => a.d - b.d)
      edgeX = dists[0].x
      edgeY = dists[0].y
    }

    const dist = Math.hypot(px - edgeX, py - edgeY)
    if (dist < bestDist) {
      bestDist = dist
      best = { x: edgeX, y: edgeY, targetId: obj.id }
    }
  })

  return best
}

export function Canvas() {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  // Line drawing state: first click sets start, second click sets end
  const [lineStart, setLineStart] = React.useState<{ x: number; y: number } | null>(null)
  const [linePreviewEnd, setLinePreviewEnd] = React.useState<{ x: number; y: number } | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const objects = useBoardStore((s) => s.objects)
  const camera = useBoardStore((s) => s.camera)
  const setCamera = useBoardStore((s) => s.setCamera)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const clearSelection = useBoardStore((s) => s.clearSelection)
  const applyLocal = useBoardStore((s) => s.applyLocal)

  const activeTool = useToolStore((s) => s.activeTool)
  const fillColor = useToolStore((s) => s.fillColor)

  const userId = useUIStore((s) => s.userId)
  const userName = useUIStore((s) => s.userName)
  const userColor = useUIStore((s) => s.userColor)

  // Compute selected lines for rendering endpoint handles
  const selectedLines = useMemo(() => {
    const lines: BoardObject[] = []
    selectedIds.forEach((id) => {
      const obj = objects.get(id)
      if (obj && (obj.type === 'line' || obj.type === 'connector')) lines.push(obj)
    })
    return lines
  }, [selectedIds, objects])

  // Update transformer when selection changes — skip lines (they get endpoint handles)
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return

    const nodes: Konva.Node[] = []
    selectedIds.forEach((id) => {
      const obj = objects.get(id)
      if (obj && (obj.type === 'line' || obj.type === 'connector')) return
      const node = stage.findOne(`#${id}`)
      if (node) nodes.push(node)
    })
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, objects])

  // Mouse move handler for cursor broadcast + line preview
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return

    const boardPos = screenToBoard(pos.x, pos.y, camera)
    sendCursor({
      userId,
      name: userName,
      color: userColor,
      x: boardPos.x,
      y: boardPos.y,
    })

    // Update line preview while drawing
    if (activeTool === 'line' && lineStart) {
      setLinePreviewEnd({ x: boardPos.x, y: boardPos.y })
    }
  }, [camera, userId, userName, userColor, activeTool, lineStart])

  // Wheel handler for zoom
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const oldZoom = camera.zoom
    const direction = e.evt.deltaY < 0 ? 1 : -1
    const factor = 1.08
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, direction > 0 ? oldZoom * factor : oldZoom / factor))

    // Zoom toward pointer position
    const mousePointTo = {
      x: (pointer.x - camera.x) / oldZoom,
      y: (pointer.y - camera.y) / oldZoom,
    }

    setCamera({
      zoom: newZoom,
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    })
  }, [camera, setCamera])

  // Clear line start when switching tools
  useEffect(() => {
    if (activeTool !== 'line') {
      setLineStart(null)
      setLinePreviewEnd(null)
    }
  }, [activeTool])

  // Open text editor overlay for a given object
  const openTextEditor = useCallback((id: string, selectAll = false) => {
    const obj = objects.get(id)
    if (!obj) return
    if (obj.type !== 'sticky' && obj.type !== 'text') return

    setEditingId(id)

    const stage = stageRef.current
    if (!stage) return

    const container = stage.container()
    const isSticky = obj.type === 'sticky'

    // Calculate screen position from board coordinates + camera
    const screenX = obj.x * camera.zoom + camera.x + (isSticky ? 10 * camera.zoom : 0)
    const screenY = obj.y * camera.zoom + camera.y + (isSticky ? 10 * camera.zoom : 0)
    const padW = isSticky ? 20 : 0
    const padH = isSticky ? 20 : 0

    const isText = obj.type === 'text'
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    textarea.value = obj.text
    textarea.style.position = 'absolute'
    textarea.style.top = `${container.offsetTop + screenY}px`
    textarea.style.left = `${container.offsetLeft + screenX}px`
    textarea.style.fontSize = `${(obj.fontSize || 16) * camera.zoom}px`
    textarea.style.border = 'none'
    textarea.style.padding = '4px'
    textarea.style.margin = '0'
    textarea.style.overflow = 'hidden'
    textarea.style.background = 'transparent'
    textarea.style.outline = 'none'
    textarea.style.resize = 'none'
    textarea.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif'
    textarea.style.color = isSticky ? '#1e1e2e' : (obj.stroke && obj.stroke !== '#000000' ? obj.stroke : '#cdd6f4')
    textarea.style.zIndex = '1000'
    textarea.style.lineHeight = '1.4'

    if (isText) {
      // Auto-sizing textarea for text objects
      textarea.style.width = 'auto'
      textarea.style.height = 'auto'
      textarea.style.minWidth = '20px'
      textarea.style.whiteSpace = 'pre'
      // Measure and auto-resize on input
      const autoSize = () => {
        textarea.style.width = '0'
        textarea.style.height = '0'
        textarea.style.width = `${Math.max(20, textarea.scrollWidth + 4)}px`
        textarea.style.height = `${textarea.scrollHeight}px`
      }
      textarea.addEventListener('input', autoSize)
      // Initial size
      requestAnimationFrame(autoSize)
    } else {
      textarea.style.width = `${(obj.width - padW) * camera.zoom}px`
      textarea.style.height = `${(obj.height - padH) * camera.zoom}px`
    }

    textarea.addEventListener('mousedown', (me) => me.stopPropagation())
    textarea.focus()

    if (selectAll) textarea.select()

    let removed = false
    const removeTextarea = () => {
      if (removed) return
      removed = true
      const newText = textarea.value
      const props: Record<string, any> = { text: newText }
      // For text objects, measure final size and update width/height to match
      if (isText && newText) {
        const measure = document.createElement('canvas').getContext('2d')
        if (measure) {
          measure.font = `${obj.fontSize || 16}px -apple-system, BlinkMacSystemFont, sans-serif`
          const lines = newText.split('\n')
          const lineHeight = (obj.fontSize || 16) * 1.4
          let maxW = 0
          for (const line of lines) {
            maxW = Math.max(maxW, measure.measureText(line).width)
          }
          props.width = Math.ceil(maxW) + 8
          props.height = Math.ceil(lines.length * lineHeight) + 4
        }
      }
      try { document.body.removeChild(textarea) } catch {}
      setEditingId(null)
      applyLocal({ type: 'object:update', id, props })
    }

    textarea.addEventListener('keydown', (ke) => {
      if (ke.key === 'Escape' || (ke.key === 'Enter' && !ke.shiftKey)) {
        removeTextarea()
      }
    })
    textarea.addEventListener('blur', removeTextarea)
  }, [objects, camera, applyLocal])

  // Double-click to edit text
  const handleDblClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    openTextEditor(id)
  }, [openTextEditor])

  // Click on stage (deselect or create)
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // If clicking on empty area
    if (e.target === e.target.getStage()) {
      if (activeTool === 'select' || activeTool === 'pan') {
        clearSelection()
        return
      }

      const stage = stageRef.current
      if (!stage) return
      const pos = stage.getPointerPosition()
      if (!pos) return
      const boardPos = screenToBoard(pos.x, pos.y, camera)

      // Two-click line drawing
      if (activeTool === 'line') {
        if (!lineStart) {
          setLineStart({ x: boardPos.x, y: boardPos.y })
          setLinePreviewEnd({ x: boardPos.x, y: boardPos.y })
          return
        } else {
          const id = generateId()
          const newObj: BoardObject = {
            id,
            type: 'line' as ObjectType,
            x: lineStart.x,
            y: lineStart.y,
            width: Math.abs(boardPos.x - lineStart.x),
            height: Math.abs(boardPos.y - lineStart.y),
            rotation: 0,
            zIndex: objects.size,
            fill: 'transparent',
            stroke: '#cdd6f4',
            strokeWidth: 2,
            opacity: 1,
            text: '',
            fontSize: 16,
            points: [0, 0, boardPos.x - lineStart.x, boardPos.y - lineStart.y],
          }
          applyLocal({ type: 'object:create', object: newObj })
          setSelectedIds(new Set([id]))
          setLineStart(null)
          setLinePreviewEnd(null)
          return
        }
      }

      // Create object based on active tool
      let newObj: BoardObject | null = null
      const id = generateId()
      const baseObj = {
        id,
        rotation: 0,
        zIndex: objects.size,
        stroke: '#000000',
        strokeWidth: 0,
        opacity: 1,
        text: '',
        fontSize: 16,
      }

      switch (activeTool) {
        case 'sticky':
          newObj = {
            ...baseObj,
            type: 'sticky' as ObjectType,
            x: boardPos.x - 75,
            y: boardPos.y - 75,
            width: 150,
            height: 150,
            fill: fillColor,
            text: '',
            fontSize: 14,
          }
          break
        case 'rect':
          newObj = {
            ...baseObj,
            type: 'rect' as ObjectType,
            x: boardPos.x - 75,
            y: boardPos.y - 40,
            width: 150,
            height: 80,
            fill: fillColor,
            strokeWidth: 2,
          }
          break
        case 'circle':
          newObj = {
            ...baseObj,
            type: 'circle' as ObjectType,
            x: boardPos.x,
            y: boardPos.y,
            width: 80,
            height: 80,
            fill: fillColor,
            strokeWidth: 2,
          }
          break
        case 'text':
          newObj = {
            ...baseObj,
            type: 'text' as ObjectType,
            x: boardPos.x,
            y: boardPos.y,
            width: 200,
            height: 30,
            fill: 'transparent',
            stroke: fillColor,
            text: '',
            fontSize: 20,
          }
          break
        case 'frame':
          newObj = {
            ...baseObj,
            type: 'frame' as ObjectType,
            x: boardPos.x - 150,
            y: boardPos.y - 100,
            width: 300,
            height: 200,
            fill: 'rgba(255,255,255,0.05)',
            stroke: '#585b70',
            strokeWidth: 2,
            text: 'Frame',
            fontSize: 14,
            labelHeight: 20,
          }
          break
      }

      if (newObj) {
        applyLocal({ type: 'object:create', object: newObj })
        setSelectedIds(new Set([id]))

        // Auto-open text editor for sticky notes and text elements
        if (newObj.type === 'sticky' || newObj.type === 'text') {
          // Small delay to let Konva render the node first
          setTimeout(() => openTextEditor(id), 50)
        }
      }
    }
  }, [activeTool, camera, fillColor, objects.size, applyLocal, clearSelection, setSelectedIds, lineStart, openTextEditor])

  // Object drag end — also moves connected lines
  const handleDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const obj = objects.get(id)
    const newX = e.target.x()
    const newY = e.target.y()

    const actions: BoardAction[] = [
      { type: 'object:update', id, props: { x: newX, y: newY } },
    ]

    // Move connected line endpoints when a shape is dragged
    if (obj && obj.type !== 'line' && obj.type !== 'connector') {
      const dx = newX - obj.x
      const dy = newY - obj.y

      objects.forEach((other) => {
        if (other.type !== 'line' && other.type !== 'connector') return
        const pts = other.points || [0, 0, 100, 0]

        if (other.sourceId === id) {
          const newStartX = other.x + dx
          const newStartY = other.y + dy
          const absEndX = other.x + pts[2]
          const absEndY = other.y + pts[3]
          actions.push({
            type: 'object:update',
            id: other.id,
            props: {
              x: newStartX,
              y: newStartY,
              points: [0, 0, absEndX - newStartX, absEndY - newStartY],
            },
          })
        }

        if (other.targetId === id) {
          actions.push({
            type: 'object:update',
            id: other.id,
            props: {
              points: [0, 0, pts[2] + dx, pts[3] + dy],
            },
          })
        }
      })
    }

    if (actions.length === 1) {
      applyLocal(actions[0])
    } else {
      applyLocal({ type: 'object:batch', actions })
    }
  }, [objects, applyLocal])

  // Endpoint drag handler for lines
  const handleEndpointDragEnd = useCallback((lineId: string, endpoint: 'start' | 'end', newX: number, newY: number) => {
    const obj = objects.get(lineId)
    if (!obj) return

    const points = obj.points || [0, 0, 100, 0]
    const snapResult = findSnapTarget(newX, newY, lineId, objects)
    const snappedX = snapResult ? snapResult.x : newX
    const snappedY = snapResult ? snapResult.y : newY

    const props: Partial<BoardObject> & Record<string, any> = {}

    if (endpoint === 'start') {
      const absEndX = obj.x + points[2]
      const absEndY = obj.y + points[3]
      props.x = snappedX
      props.y = snappedY
      props.points = [0, 0, absEndX - snappedX, absEndY - snappedY]
      props.sourceId = snapResult ? snapResult.targetId : ''
    } else {
      props.points = [0, 0, snappedX - obj.x, snappedY - obj.y]
      props.targetId = snapResult ? snapResult.targetId : ''
    }

    // If snapped, ensure line renders under the shape
    if (snapResult) {
      const targetObj = objects.get(snapResult.targetId)
      if (targetObj && obj.zIndex >= targetObj.zIndex) {
        props.zIndex = targetObj.zIndex - 0.5
      }
    }

    applyLocal({ type: 'object:update', id: lineId, props })
  }, [objects, applyLocal])

  // Object transform end
  const handleTransformEnd = useCallback((id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)

    applyLocal({
      type: 'object:update',
      id,
      props: {
        x: node.x(),
        y: node.y(),
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
        rotation: node.rotation(),
      },
    })
  }, [applyLocal])

  // Select an object
  const handleObjectClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'select') return
    e.cancelBubble = true

    if (e.evt.shiftKey) {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set([id]))
    }
  }, [activeTool, selectedIds, setSelectedIds])

  // Render each board object
  const renderObject = useCallback((obj: BoardObject) => {
    const isSelected = selectedIds.has(obj.id)
    const draggable = activeTool === 'select'

    const commonProps = {
      id: obj.id,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation,
      draggable,
      onClick: (e: any) => handleObjectClick(obj.id, e),
      onDblClick: (e: any) => handleDblClick(obj.id, e),
      onDragEnd: (e: any) => handleDragEnd(obj.id, e),
      onTransformEnd: (e: any) => handleTransformEnd(obj.id, e),
    }

    switch (obj.type) {
      case 'sticky':
        return (
          <Group key={obj.id} {...commonProps} width={obj.width} height={obj.height}>
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.fill}
              cornerRadius={4}
              shadowColor="rgba(0,0,0,0.15)"
              shadowBlur={8}
              shadowOffsetY={2}
            />
            <Text
              id={`${obj.id}-text`}
              x={10}
              y={10}
              width={obj.width - 20}
              height={obj.height - 20}
              text={editingId === obj.id ? '' : obj.text}
              fontSize={obj.fontSize}
              fill="#1e1e2e"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              wrap="word"
            />
          </Group>
        )

      case 'rect':
        return obj.text ? (
          <Group key={obj.id} {...commonProps} width={obj.width} height={obj.height}>
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.fill}
              stroke={obj.stroke}
              strokeWidth={obj.strokeWidth}
              cornerRadius={4}
            />
            <Text
              x={8}
              y={obj.height / 2 - 8}
              width={obj.width - 16}
              text={obj.text}
              fontSize={obj.fontSize || 14}
              fill="#ffffff"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        ) : (
          <Rect
            key={obj.id}
            {...commonProps}
            width={obj.width}
            height={obj.height}
            fill={obj.fill}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            cornerRadius={2}
          />
        )

      case 'circle':
        return obj.text ? (
          <Group key={obj.id} {...commonProps}>
            <Circle
              x={obj.width / 2}
              y={obj.width / 2}
              radius={obj.width / 2}
              fill={obj.fill}
              stroke={obj.stroke}
              strokeWidth={obj.strokeWidth}
            />
            <Text
              x={0}
              y={obj.width / 2 - 8}
              width={obj.width}
              text={obj.text}
              fontSize={obj.fontSize || 13}
              fill="#ffffff"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        ) : (
          <Circle
            key={obj.id}
            {...commonProps}
            radius={obj.width / 2}
            fill={obj.fill}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
          />
        )

      case 'line':
        return (
          <Line
            key={obj.id}
            {...commonProps}
            points={obj.points || [0, 0, 100, 0]}
            stroke={obj.stroke || '#cdd6f4'}
            strokeWidth={obj.strokeWidth || 2}
          />
        )

      case 'text':
        return (
          <Text
            key={obj.id}
            id={`${obj.id}-text`}
            {...commonProps}
            text={editingId === obj.id ? '' : (obj.text || ' ')}
            fontSize={obj.fontSize || 16}
            fill={obj.stroke || '#cdd6f4'}
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          />
        )

      case 'frame':
        return (
          <Group key={obj.id} {...commonProps} width={obj.width} height={obj.height}>
            <Text
              x={0}
              y={-20}
              text={obj.text}
              fontSize={obj.fontSize}
              fill="#a6adc8"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              listening={false}
            />
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.fill}
              stroke={obj.stroke}
              strokeWidth={obj.strokeWidth}
              cornerRadius={8}
              dash={[8, 4]}
            />
          </Group>
        )

      case 'connector':
        return (
          <Arrow
            key={obj.id}
            {...commonProps}
            points={obj.points || [0, 0, 100, 100]}
            stroke={obj.stroke || '#89b4fa'}
            strokeWidth={obj.strokeWidth || 2}
            fill={obj.stroke || '#89b4fa'}
            pointerLength={10}
            pointerWidth={8}
          />
        )

      default:
        return null
    }
  }, [selectedIds, activeTool, handleObjectClick, handleDblClick, handleDragEnd, handleTransformEnd])

  // Sort objects by zIndex
  const sortedObjects = Array.from(objects.values()).sort((a, b) => a.zIndex - b.zIndex)

  return (
    <Stage
      ref={stageRef}
      width={window.innerWidth}
      height={window.innerHeight}
      scaleX={camera.zoom}
      scaleY={camera.zoom}
      x={camera.x}
      y={camera.y}
      draggable={activeTool === 'pan' || activeTool === 'select'}
      onDragEnd={(e) => {
        if (e.target === stageRef.current) {
          setCamera({ x: e.target.x(), y: e.target.y() })
        }
      }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onClick={handleStageClick}
    >
      {/* Grid layer */}
      <Layer listening={false}>
        <GridBackground camera={camera} />
      </Layer>

      {/* Line drawing preview layer */}
      {lineStart && linePreviewEnd && (
        <Layer listening={false}>
          {/* Preview line */}
          <Line
            points={[lineStart.x, lineStart.y, linePreviewEnd.x, linePreviewEnd.y]}
            stroke="#89b4fa"
            strokeWidth={2 / camera.zoom}
            dash={[8 / camera.zoom, 4 / camera.zoom]}
          />
          {/* Start point */}
          <Circle x={lineStart.x} y={lineStart.y} radius={5 / camera.zoom} fill="#89b4fa" />
          <Text
            x={lineStart.x + 8 / camera.zoom}
            y={lineStart.y - 18 / camera.zoom}
            text="Start"
            fontSize={12 / camera.zoom}
            fill="#89b4fa"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            fontStyle="bold"
          />
          {/* End point (cursor) */}
          <Circle x={linePreviewEnd.x} y={linePreviewEnd.y} radius={5 / camera.zoom} fill="#f38ba8" />
          <Text
            x={linePreviewEnd.x + 8 / camera.zoom}
            y={linePreviewEnd.y - 18 / camera.zoom}
            text="End"
            fontSize={12 / camera.zoom}
            fill="#f38ba8"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            fontStyle="bold"
          />
        </Layer>
      )}

      {/* Objects layer */}
      <Layer>
        {sortedObjects.map(renderObject)}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox
            return newBox
          }}
          rotateEnabled={true}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          borderStroke="#89b4fa"
          anchorStroke="#89b4fa"
          anchorFill="#313244"
          anchorSize={8}
        />
        {/* Line endpoint handles */}
        {selectedLines.map((line) => (
          <LineEndpointHandles
            key={`handles-${line.id}`}
            line={line}
            camera={camera}
            objects={objects}
            onDragEnd={handleEndpointDragEnd}
          />
        ))}
      </Layer>
    </Stage>
  )
}

// Draggable endpoint handles for selected lines
function LineEndpointHandles({
  line,
  camera,
  objects,
  onDragEnd,
}: {
  line: BoardObject
  camera: { x: number; y: number; zoom: number }
  objects: Map<string, BoardObject>
  onDragEnd: (lineId: string, endpoint: 'start' | 'end', x: number, y: number) => void
}) {
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number } | null>(null)
  const points = line.points || [0, 0, 100, 0]
  const handleRadius = 6 / camera.zoom
  const strokeW = 1.5 / camera.zoom

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const x = e.target.x()
    const y = e.target.y()
    const snap = findSnapTarget(x, y, line.id, objects)
    setSnapPreview(snap ? { x: snap.x, y: snap.y } : null)
  }, [line.id, objects])

  const handleDragEndStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setSnapPreview(null)
    onDragEnd(line.id, 'start', e.target.x(), e.target.y())
  }, [line.id, onDragEnd])

  const handleDragEndEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setSnapPreview(null)
    onDragEnd(line.id, 'end', e.target.x(), e.target.y())
  }, [line.id, onDragEnd])

  return (
    <>
      {/* Snap preview indicator */}
      {snapPreview && (
        <Circle
          x={snapPreview.x}
          y={snapPreview.y}
          radius={10 / camera.zoom}
          fill="transparent"
          stroke="#89b4fa"
          strokeWidth={2 / camera.zoom}
          dash={[4 / camera.zoom, 2 / camera.zoom]}
          listening={false}
        />
      )}
      {/* Start handle */}
      <Circle
        x={line.x}
        y={line.y}
        radius={handleRadius}
        fill="#89b4fa"
        stroke="#313244"
        strokeWidth={strokeW}
        draggable
        onDragMove={handleDragMove}
        onDragEnd={handleDragEndStart}
      />
      {/* End handle */}
      <Circle
        x={line.x + points[2]}
        y={line.y + points[3]}
        radius={handleRadius}
        fill="#f38ba8"
        stroke="#313244"
        strokeWidth={strokeW}
        draggable
        onDragMove={handleDragMove}
        onDragEnd={handleDragEndEnd}
      />
    </>
  )
}

// Grid background component
function GridBackground({ camera }: { camera: { x: number; y: number; zoom: number } }) {
  const theme = useUIStore((s) => s.canvasTheme)
  const showGrid = useUIStore((s) => s.showGrid)
  const colors = themeConfig[theme]
  const gridSize = 40
  const width = window.innerWidth / camera.zoom + gridSize * 2
  const height = window.innerHeight / camera.zoom + gridSize * 2

  const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize - gridSize
  const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize - gridSize

  const bgX = startX - gridSize
  const bgY = startY - gridSize

  if (!showGrid) {
    return <Rect x={bgX} y={bgY} width={width + gridSize * 2} height={height + gridSize * 2} fill={colors.bg} />
  }

  const lines: React.ReactElement[] = []
  for (let x = startX; x < startX + width; x += gridSize) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, startY, x, startY + height]}
        stroke={colors.grid}
        strokeWidth={1 / camera.zoom}
      />
    )
  }
  for (let y = startY; y < startY + height; y += gridSize) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[startX, y, startX + width, y]}
        stroke={colors.grid}
        strokeWidth={1 / camera.zoom}
      />
    )
  }

  return (
    <>
      <Rect x={bgX} y={bgY} width={width + gridSize * 2} height={height + gridSize * 2} fill={colors.bg} />
      {lines}
    </>
  )
}
