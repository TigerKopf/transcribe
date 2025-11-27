import { Component, OnInit } from '@angular/core';
import { RadioService } from '../shared/services/radio.service';

@Component({
  selector: 'app-listeners-page',
  templateUrl: './listeners-page.component.html',
  styleUrls: ['./listeners-page.component.scss']
})
export class ListenersPageComponent implements OnInit {

  constructor(
    public radio: RadioService
  ) { }

  ngOnInit() {
  }

  playStation(stationId: string) {
    console.log('Playing station:', stationId);
    if (this.radio.context.state === 'suspended') {
      this.radio.context.resume();
    }
    if (this.radio.station && this.radio.station.id !== stationId) {
      const currentStationId = this.radio.station.id;
      this.radio.leave(currentStationId);
      // Add a small delay to allow cleanup to complete before joining a new station
      setTimeout(() => {
        this.radio.join(stationId);
      }, 500); // 500ms delay
    } else if (!this.radio.station) {
      this.radio.join(stationId);
    }
  }

  stopPlayback() {
    console.log('Stopping current station.');
    if (this.radio.station) {
      this.radio.leave(this.radio.station.id);
    }
  }

}
