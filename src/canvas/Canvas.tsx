import React, { useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Circle, Line, Group, Text, Arrow, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../store/boardStore'
import { useToolStore } from '../store/toolStore'
import { useUIStore } from '../store/uiStore'
import { sendCursor } from '../sync/socket'
import { generateId, screenToBoard } from '../lib/utils'
import type { BoardObject, ObjectType } from '../../shared/types'
import { STICKY_COLORS } from '../../shared/types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

export function Canvas() {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

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

  // Update transformer when selection changes
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return

    const nodes: Konva.Node[] = []
    selectedIds.forEach((id) => {
      const node = stage.findOne(`#${id}`)
      if (node) nodes.push(node)
    })
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, objects])

  // Mouse move handler for cursor broadcast
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
  }, [camera, userId, userName, userColor])

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
            text: 'New note',
            fontSize: 14,
          }
          break
        case 'rect':
          newObj = {
            ...baseObj,
            type: 'rect' as ObjectType,
            x: boardPos.x - 50,
            y: boardPos.y - 50,
            width: 100,
            height: 100,
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
            text: 'Text',
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
          }
          break
      }

      if (newObj) {
        applyLocal({ type: 'object:create', object: newObj })
        setSelectedIds(new Set([id]))
      }
    }
  }, [activeTool, camera, fillColor, objects.size, applyLocal, clearSelection, setSelectedIds])

  // Object drag end
  const handleDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    applyLocal({
      type: 'object:update',
      id,
      props: { x: e.target.x(), y: e.target.y() },
    })
  }, [applyLocal])

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

  // Double-click to edit text
  const handleDblClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    const obj = objects.get(id)
    if (!obj) return
    if (obj.type !== 'sticky' && obj.type !== 'text') return

    e.cancelBubble = true
    const stage = stageRef.current
    if (!stage) return

    // Create textarea overlay
    const textNode = stage.findOne(`#${id}-text`) as Konva.Text
    if (!textNode) return

    const textPosition = textNode.absolutePosition()
    const areaPosition = {
      x: stage.container().offsetLeft + textPosition.x,
      y: stage.container().offsetTop + textPosition.y,
    }

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    textarea.value = obj.text
    textarea.style.position = 'absolute'
    textarea.style.top = `${areaPosition.y}px`
    textarea.style.left = `${areaPosition.x}px`
    textarea.style.width = `${obj.width * camera.zoom - 20}px`
    textarea.style.height = `${obj.height * camera.zoom - 20}px`
    textarea.style.fontSize = `${obj.fontSize * camera.zoom}px`
    textarea.style.border = 'none'
    textarea.style.padding = '4px'
    textarea.style.margin = '0'
    textarea.style.overflow = 'hidden'
    textarea.style.background = 'transparent'
    textarea.style.outline = 'none'
    textarea.style.resize = 'none'
    textarea.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif'
    textarea.style.color = '#1e1e2e'
    textarea.style.zIndex = '1000'
    textarea.focus()

    const removeTextarea = () => {
      const newText = textarea.value
      document.body.removeChild(textarea)
      applyLocal({ type: 'object:update', id, props: { text: newText } })
    }

    textarea.addEventListener('keydown', (ke) => {
      if (ke.key === 'Escape' || (ke.key === 'Enter' && !ke.shiftKey)) {
        removeTextarea()
      }
    })
    textarea.addEventListener('blur', removeTextarea)
  }, [objects, camera, applyLocal])

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
          <Group key={obj.id} {...commonProps}>
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
              text={obj.text}
              fontSize={obj.fontSize}
              fill="#1e1e2e"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              wrap="word"
            />
          </Group>
        )

      case 'rect':
        return (
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
        return (
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
            text={obj.text}
            fontSize={obj.fontSize}
            fill="#cdd6f4"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            width={obj.width}
          />
        )

      case 'frame':
        return (
          <Group key={obj.id} {...commonProps}>
            <Text
              x={0}
              y={-20}
              text={obj.text}
              fontSize={obj.fontSize}
              fill="#a6adc8"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
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
      </Layer>
    </Stage>
  )
}

// Grid background component
function GridBackground({ camera }: { camera: { x: number; y: number; zoom: number } }) {
  const gridSize = 40
  const width = window.innerWidth / camera.zoom + gridSize * 2
  const height = window.innerHeight / camera.zoom + gridSize * 2

  const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize - gridSize
  const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize - gridSize

  const lines: React.ReactElement[] = []
  for (let x = startX; x < startX + width; x += gridSize) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, startY, x, startY + height]}
        stroke="#313244"
        strokeWidth={1 / camera.zoom}
      />
    )
  }
  for (let y = startY; y < startY + height; y += gridSize) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[startX, y, startX + width, y]}
        stroke="#313244"
        strokeWidth={1 / camera.zoom}
      />
    )
  }

  return <>{lines}</>
}
