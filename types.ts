
export enum Frequency {
  ONE_OFF = 'One-Off',
  DAILY = 'Daily',
  BI_WEEKLY = 'Bi-Weekly',
  WEEKLY = 'Weekly',
  BI_MONTHLY = 'Bi-Monthly',
  MONTHLY = 'Monthly'
}

export interface Fruit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  price: number;
  description: string;
}

export interface BoxItem {
  fruitId: string;
  quantity: number;
}

export interface Subscription {
  items: BoxItem[];
  frequency: Frequency;
  teamSize: number;
}
