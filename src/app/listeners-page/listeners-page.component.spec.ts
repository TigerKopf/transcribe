import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ListenersPageComponent } from './listeners-page.component';

describe('ListenersPageComponent', () => {
  let component: ListenersPageComponent;
  let fixture: ComponentFixture<ListenersPageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ListenersPageComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListenersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
