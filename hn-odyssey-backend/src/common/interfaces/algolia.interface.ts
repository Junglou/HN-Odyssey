export interface IAlgoliaRecommendHit {
  objectID: string;
  _score: number;
}

export interface IAlgoliaRecommendResponse {
  results: [
    {
      hits: IAlgoliaRecommendHit[];
    },
  ];
}

export interface IAlgoliaInsightEvent {
  eventType: 'click' | 'conversion' | 'view';
  eventName: string;
  index: string;
  userToken: string;
  objectIDs: string[];
  queryID?: string; // Tùy chọn nếu có tìm kiếm
  positions?: number[]; // Bắt buộc cho click/conversion nếu dùng queryID
}

export interface IAlgoliaInsightPayload {
  events: IAlgoliaInsightEvent[];
}

export interface IAlgoliaFacetHit {
  facetValue: string;
  facetName: string;
  _score?: number;
}

export interface IRecommendationResult {
  title: string; // Dùng để Frontend hiển thị title Widget
  type: string; // 'TRENDING' | 'RELATED' | 'SIMILAR'
  products: any[]; // Sẽ map sang ProductDocument
}
