import React from "react";

import { Row } from "./row";
import { Item, RowCreator } from "./shared";

type Props<Row extends HTMLElement, I extends Item> = Readonly<{
  items: I[];
  setItems: (items: I[]) => void;
  row: RowCreator<Row, I>;
}>;

// getBoundingClientRect cannot be used because it correctly reflects the position even during CSS transitions.
const getDOMPosition = (dom: Nullable<HTMLElement> | null) => {
  if (dom == undefined) return undefined;

  const transformYString = dom.getAttribute("sortable-list-translate-y");
  const transformY = transformYString == undefined ? 0 : Number(transformYString);

  const top = dom.offsetTop + transformY;
  const bottom = top + dom.clientHeight;

  return { top, bottom };
};

export const SortableList = <Row extends HTMLElement, I extends Item>(props: Props<Row, I>) => {
  const [currentDraggedIndexState, setCurrentDraggedIndexState] = React.useState<number>();
  const [draggingItemIdState, setDraggingItemId] = React.useState<React.Key>();
  const rowRefs = React.useRef<React.RefObject<Row>[]>([]);
  const upDiffRef = React.useRef<number>();
  const downDiffRef = React.useRef<number>();

  const idToIndex = React.useMemo(
    () => props.items.reduce((previous, current, i) => ({ ...previous, [current.id]: i }), {} as Record<React.Key, number>),
    [props.items],
  );

  const setItems = React.useCallback(() => {
    if (draggingItemIdState == undefined || currentDraggedIndexState == undefined) return;

    const draggingItemIndex = idToIndex[draggingItemIdState];
    if (draggingItemIndex === currentDraggedIndexState) return;

    const items = [...props.items];
    const [item] = items.splice(draggingItemIndex, 1);
    items.splice(currentDraggedIndexState, 0, item);

    props.setItems(items);
  }, [props.setItems, currentDraggedIndexState, draggingItemIdState]);

  const onStartDragging = React.useCallback(
    (item: I) => {
      setDraggingItemId(item.id);

      const index = idToIndex[item.id];
      const draggingRect = rowRefs.current[index].current?.getBoundingClientRect();
      if (draggingRect == undefined) return;

      const upRect = rowRefs.current[index - 1]?.current?.getBoundingClientRect();
      const downRect = rowRefs.current[index + 1]?.current?.getBoundingClientRect();
      if (upRect != undefined) upDiffRef.current = draggingRect.bottom - upRect.bottom;
      if (downRect != undefined) downDiffRef.current = draggingRect.top - downRect.top;
    },
    [idToIndex],
  );

  const onDrag = React.useCallback(
    (item: I) => {
      const index = idToIndex[item.id];

      const draggingDOMPosition = getDOMPosition(rowRefs.current[index].current);
      if (draggingDOMPosition == undefined) return;

      const [upIndex, downIndex] = (() => {
        if (currentDraggedIndexState == undefined) return [index - 1, index + 1];
        if (currentDraggedIndexState < index) return [currentDraggedIndexState - 1, currentDraggedIndexState];
        if (currentDraggedIndexState > index) return [currentDraggedIndexState, currentDraggedIndexState + 1];

        return [index - 1, index + 1];
      })();

      const upDOMPosition = getDOMPosition(rowRefs.current[upIndex]?.current);
      const downDOMPosition = getDOMPosition(rowRefs.current[downIndex]?.current);

      if (upDOMPosition != undefined && draggingDOMPosition.top < upDOMPosition.top) {
        setCurrentDraggedIndexState((currentDraggedIndexState ?? index) - 1);
      }
      if (downDOMPosition != undefined && draggingDOMPosition.bottom > downDOMPosition.bottom) {
        setCurrentDraggedIndexState((currentDraggedIndexState ?? index) + 1);
      }
    },
    [idToIndex, currentDraggedIndexState],
  );

  const onFinishDragging = React.useCallback(() => {
    setDraggingItemId(undefined);
    setItems();
    setCurrentDraggedIndexState(undefined);
  }, [setItems]);

  const itemIndexToTranslateY = React.useMemo<(i: number) => number>(() => {
    if (draggingItemIdState == undefined || currentDraggedIndexState == undefined) return () => 0;

    const draggingItemIndex = idToIndex[draggingItemIdState];

    if (draggingItemIndex < currentDraggedIndexState) {
      return (i) => {
        if (i < draggingItemIndex || currentDraggedIndexState < i) return 0;
        if (i === draggingItemIndex) return 0;

        return downDiffRef.current ?? 0;
      };
    }
    if (draggingItemIndex > currentDraggedIndexState) {
      return (i) => {
        if (i < currentDraggedIndexState || draggingItemIndex < i) return 0;
        if (i === draggingItemIndex) return 0;

        return upDiffRef.current ?? 0;
      };
    }

    return () => 0;
  }, [currentDraggedIndexState, draggingItemIdState]);

  const rows = React.useMemo(
    () =>
      props.items.map((item, i) => {
        const ref = React.createRef<Row>();
        rowRefs.current[i] = ref;

        return (
          <Row
            key={item.id}
            ref={ref}
            item={item}
            translateY={itemIndexToTranslateY(i)}
            isDraggingAny={draggingItemIdState != undefined}
            row={props.row}
            onStartDragging={onStartDragging}
            onDrag={onDrag}
            onFinishDragging={onFinishDragging}
          />
        );
      }),
    [props.items, props.row, draggingItemIdState, onDrag, itemIndexToTranslateY],
  );

  return <>{rows}</>;
};
