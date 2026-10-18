// The photographs the lessons use, and how each one is cut up by distance.
// All are from Flickr via Google's Open Images, under CC BY 2.0.

import type { PhotoSpec } from './photo'

export const CAFE: PhotoSpec = {
  id: 'cafe',
  ev: 12,
  kelvin: 6200,
  edges: [0.2, 0.33, 0.39, 0.46, 0.55, 0.66, 0.8, 1.05, 1.6, 2.8, 5, 10, 20],
  labels: {
    1: 'the cappuccino',
    2: 'the croissant',
    3: 'the table',
    4: 'the helmet bag',
    5: 'the bike',
    6: 'the chair',
    7: 'the motorbike',
    8: 'the person walking',
    9: 'the napkin holder',
  },
  ground: 'the pavement',
  far: 'the street',
}

// The café table, cropped in to 1.5×, as if shot with the 2× lens a step back.
export const CAFE_CLOSE: PhotoSpec = { ...CAFE, zoom: 1.5, center: [0.42, 0.5] }

export const PORTRAIT: PhotoSpec = {
  id: 'portrait',
  ev: 13,
  kelvin: 5600,
  edges: [0.5, 1.2, 2.5, 4.5, 9, 20],
  labels: { 1: 'her', 2: 'the crowd' },
  ground: 'the background',
  far: 'the trees',
}

export const NIGHT: PhotoSpec = {
  id: 'night',
  ev: 3,
  meterEv: 2,
  kelvin: 2900,
  edges: [1, 2.4, 2.9, 3.4, 4.2, 5.2, 7, 11, 20],
  lights: { threshold: 0.94, power: 9 },
  labels: { 1: 'your friend', 2: 'your friend', 3: 'your friend', 4: 'your friend', 5: 'someone further back', 6: 'the road sign' },
  ground: 'the street',
  far: 'the street lights',
}

export const WATERFALL: PhotoSpec = {
  id: 'waterfall',
  ev: 11,
  kelvin: 6500,
  edges: [1, 8, 13, 25],
  objects: [{ id: 'water', depth: 15, motion: [0, 0.55], label: 'the waterfall', flow: true }],
  labels: { 1: 'the waterfall', 2: 'the pool' },
  ground: 'the rocks',
  far: 'the forest',
}

export const CYCLIST: PhotoSpec = {
  id: 'cyclist',
  ev: 13,
  kelvin: 5800,
  edges: [1, 4, 7, 10],
  plate: true,
  objects: [{ id: 'rider', depth: 5.5, motion: [-0.32, 0], label: 'the cyclist' }],
  ground: 'the road',
  far: 'the trees',
}

export const TRAFFIC: PhotoSpec = {
  id: 'traffic',
  ev: 6,
  kelvin: 3800,
  edges: [1, 4, 12, 30],
  lights: { threshold: 0.9, power: 14 },
  plate: true,
  objects: [
    { id: 'car', depth: 7, motion: [0.5, 0], label: 'the car behind' },
    { id: 'taxi', depth: 5, motion: [0.5, 0], label: 'the taxi' },
  ],
  ground: 'the road',
  far: 'the neon signs',
}

export const SNOW: PhotoSpec = {
  id: 'snow',
  ev: 14,
  // All that white fools an averaging meter into making it middle grey.
  meterEv: 15.4,
  kelvin: 6500,
  edges: [0.5, 1.8, 3, 5, 9, 18],
  labels: { 1: 'her' },
  ground: 'the snow',
  far: 'the trees',
}

export const LAKE: PhotoSpec = {
  id: 'lake',
  ev: 12,
  kelvin: 5200,
  edges: [1, 60, 500],
  labels: { 1: 'the rocks', 2: 'the duck' },
  ground: 'the lake',
  far: 'the mountains',
}

export const CREDITS = [
  { what: 'Café table', title: 'Illy por la mañana', author: 'Carlos Felipe Pardo', url: 'https://www.flickr.com/photos/carlosfpardo/1119654394' },
  { what: 'Portrait', title: 'IMG_0261', author: 'VOCAL-NY', url: 'https://www.flickr.com/photos/vocal-ny/17315593601' },
  { what: 'Night street', title: 'Leipzig nightlife (LGM 2014)', author: 'Manuel Schmalstieg', url: 'https://www.flickr.com/photos/kinetoskop/13693226785' },
  { what: 'Waterfall', title: 'Ninai Taki fall', author: 'coniferconifer', url: 'https://www.flickr.com/photos/conifer/15624436142' },
  { what: 'Cyclist', title: 'Sun haze biking', author: 'Andreas Kambanis', url: 'https://www.flickr.com/photos/andikam/15284893092' },
  { what: 'Traffic', title: 'Shinjuku', author: 'Jose Antonio Navas', url: 'https://www.flickr.com/photos/joseanavas/4007979976/' },
  { what: 'Snow', title: 'In the “garden” March 2010', author: 'Michael Charron-Plante', url: 'https://www.flickr.com/photos/mvplante/4748943779' },
  { what: 'Lake', title: 'Austria', author: 'Moyan Brenn', url: 'https://www.flickr.com/photos/aigle_dore/9053939735' },
  { what: 'Lighthouse', title: 'Yaquina Lighthouse, Newport Oregon', author: 'Harold Litwiler', url: 'https://www.flickr.com/photos/a_little_brighter/19085882673' },
]
