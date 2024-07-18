import type { Connector } from 'instantsearch.js/es';

export type ViewConnectorParams<TView extends string> = {
  defaultView: TView;
};

export type ViewRenderState<TView extends string> = {
  view: TView;
  refine: (view: TView) => void;
};

export type ViewIndexUiState<TView extends string> = {
  view: TView;
};

export type ViewWidgetDescription<TView extends string> = {
  $$type: 'haroen.view';
  renderState: ViewRenderState<TView>;
  indexRenderState: {
    view: ViewRenderState<TView>;
  };
  indexUiState: ViewIndexUiState<TView>;
};

/*
 * Connector type, constructed from the Renderer and Connector parameters
 */
export type ViewConnector<TView extends string> = Connector<
  ViewWidgetDescription<TView>,
  ViewConnectorParams<TView>
>;
